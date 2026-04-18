import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { generateAndUploadImage, type ImageTier } from "@/lib/image-gen";

interface CardInput {
  front: string;
  back: string;
  index: number;
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const isPro = await isProUser(auth.userId);
  if (!isPro) {
    return NextResponse.json(
      { error: "Pro subscription required for AI image generation" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { cards } = body as { cards: CardInput[] };
  const tier: ImageTier = body.tier === "premium" ? "premium" : "quick";

  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return NextResponse.json(
      { error: "Cards array is required" },
      { status: 400 }
    );
  }

  if (cards.length > 30) {
    return NextResponse.json(
      { error: "Maximum 30 images per batch" },
      { status: 400 }
    );
  }

  try {
    const results: { index: number; imageUrl: string | null; error?: string }[] = [];

    for (const card of cards) {
      try {
        const imageUrl = await generateAndUploadImage(auth.userId, card.front, card.back, tier);
        results.push({ index: card.index, imageUrl });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed";
        results.push({ index: card.index, imageUrl: null, error: msg });
      }
    }

    return NextResponse.json({ results, tier });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
