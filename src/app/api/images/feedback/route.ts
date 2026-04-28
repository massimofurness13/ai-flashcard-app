import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { generateAndUploadImage, type ImageTier } from "@/lib/image-gen";
import { rateLimit } from "@/lib/validations";

/**
 * Image feedback + free regeneration.
 *
 * The user looks at an AI image, decides it's not memorable / wrong,
 * and submits a written reason. In exchange we regenerate the image
 * once at the same tier — free of credit cost. This gives us a
 * continuously-growing dataset of (concept → image → "why didn't this
 * work") that we can scan for patterns and fold into the prompt.
 *
 * Limits:
 *  - One free regen per card (Card.freeImageRegenUsed flag).
 *    Subsequent feedback is still logged (still useful data) but
 *    won't trigger another paid generation cycle for free.
 *  - Rate limited per-user to stop someone scripting "feedback" to
 *    farm regens. 5 / minute is generous for honest use, miserable
 *    for abuse.
 *
 * The request needs the card ID and the feedback text. Tier is
 * looked up from Card.imageTier (set when the original image was
 * generated). If the card has no recorded tier — historical data,
 * or an uploaded image — we default to premium since that's what
 * we'd recommend the user generate.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (!rateLimit(`image-feedback:${auth.userId}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Too many feedback submissions. Please wait a moment." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const cardId = typeof body.cardId === "string" ? body.cardId : "";
  const feedback =
    typeof body.feedback === "string" ? body.feedback.trim() : "";

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }
  if (!feedback || feedback.length < 3) {
    return NextResponse.json(
      { error: "Tell us a bit about what was off — at least a few words." },
      { status: 400 }
    );
  }
  if (feedback.length > 500) {
    return NextResponse.json(
      { error: "Feedback is too long. Keep it under 500 characters." },
      { status: 400 }
    );
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: { select: { userId: true } } },
  });
  if (!card || card.deck.userId !== auth.userId) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  if (!card.imageUrl) {
    return NextResponse.json(
      { error: "This card has no image to give feedback on." },
      { status: 400 }
    );
  }

  const tier: ImageTier = card.imageTier === "quick" ? "quick" : "premium";

  // Always log the feedback — even if the user has already used their
  // free regen for this card. The data is what matters for tuning.
  await prisma.imageFeedback.create({
    data: {
      userId: auth.userId,
      cardId: card.id,
      cardFront: card.front,
      cardBack: card.back,
      imageUrl: card.imageUrl,
      imageTier: tier,
      feedback,
    },
  });

  if (card.freeImageRegenUsed) {
    return NextResponse.json({
      regenerated: false,
      message:
        "Thanks — feedback logged. You've already used your free regen on this card; if you'd like another, you can generate one from the edit page using credits.",
    });
  }

  try {
    const newImageUrl = await generateAndUploadImage(
      auth.userId,
      card.front,
      card.back,
      tier
    );
    await prisma.card.update({
      where: { id: card.id },
      data: { imageUrl: newImageUrl, freeImageRegenUsed: true },
    });
    return NextResponse.json({
      regenerated: true,
      imageUrl: newImageUrl,
      tier,
    });
  } catch (err) {
    // The feedback row is already saved above; only the regen failed.
    // Don't flip freeImageRegenUsed so the user can try again.
    const message =
      err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json(
      { error: `Couldn't regenerate: ${message}. Feedback saved.` },
      { status: 500 }
    );
  }
}
