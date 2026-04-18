import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  generateAndUploadFromCard,
  generateAndUploadFromPrompt,
} from "@/lib/stability-ai";
import { generateImageSchema, rateLimit } from "@/lib/validations";
import { consumeImageCredit, refundImageCredit } from "@/lib/image-quota";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (!rateLimit(`image:${auth.userId}`, 20, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = generateImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  // Consume a credit BEFORE generation — refund on failure
  const consumed = await consumeImageCredit(auth.userId);
  if (!consumed.ok) {
    return NextResponse.json(
      {
        error: "out_of_quota",
        quota: consumed.state,
      },
      { status: 402 }
    );
  }

  const { front, back, customPrompt } = parsed.data;

  try {
    const imageUrl = customPrompt
      ? await generateAndUploadFromPrompt(auth.userId, customPrompt)
      : await generateAndUploadFromCard(auth.userId, front || "", back || "");
    return NextResponse.json({ imageUrl });
  } catch (error) {
    // Refund the credit since generation failed
    await refundImageCredit(auth.userId, consumed.source);

    const message =
      error instanceof Error ? error.message : "Image generation failed";

    if (message.includes("STABILITY_API_KEY")) {
      return NextResponse.json(
        { error: "Stability AI API key not configured" },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
