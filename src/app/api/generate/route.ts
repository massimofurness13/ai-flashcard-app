import { NextResponse } from "next/server";
import { generateFlashcards } from "@/lib/claude";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { generateSchema, rateLimit } from "@/lib/validations";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (!rateLimit(`generate:${auth.userId}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const isPro = await isProUser(auth.userId);
  if (!isPro) {
    return NextResponse.json(
      { error: "Pro subscription required for AI generation" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { topic, material } = parsed.data;

  try {
    const cards = await generateFlashcards({
      topic: topic.trim(),
      material: material?.trim(),
    });

    return NextResponse.json({ cards });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate flashcards";

    if (message.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json(
        { error: "API key not configured. Set ANTHROPIC_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
