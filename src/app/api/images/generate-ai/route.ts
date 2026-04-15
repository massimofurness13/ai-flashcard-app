import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import {
  generateAndUploadImage,
  buildImagePrompt,
} from "@/lib/stability-ai";
import { generateImageSchema, rateLimit } from "@/lib/validations";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (!rateLimit(`image:${auth.userId}`, 20, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const isPro = await isProUser(auth.userId);
  if (!isPro) {
    return NextResponse.json(
      { error: "Pro subscription required for AI image generation" },
      { status: 403 }
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

  const { front, back, customPrompt } = parsed.data;

  try {
    const prompt = customPrompt || buildImagePrompt(front || "", back || "");
    const imageUrl = await generateAndUploadImage(auth.userId, prompt);
    return NextResponse.json({ imageUrl });
  } catch (error) {
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
