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
    // Log the raw error for our debugging, but DON'T pipe Anthropic's
    // verbose stack-y strings (e.g. "Error 429: rate_limit_error...")
    // directly into the user-facing toast. Map to short, friendly
    // messages and stash the technical detail server-side.
    console.error("[/api/generate]", error);

    const raw =
      error instanceof Error ? error.message : "Failed to generate flashcards";

    if (raw.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json(
        { error: "AI service not configured. Please contact support." },
        { status: 500 },
      );
    }

    // Anthropic SDK throws structured errors; we sniff by status if
    // available and fall back to message-string matching for
    // robustness across SDK versions.
    const status =
      (error as { status?: number; statusCode?: number })?.status ??
      (error as { statusCode?: number })?.statusCode;
    if (status === 429 || /rate_?limit|429/i.test(raw)) {
      return NextResponse.json(
        {
          error:
            "AI is busy right now. Please wait a minute and try again.",
        },
        { status: 503 },
      );
    }
    if (status === 401 || /invalid.*api.*key|authentication/i.test(raw)) {
      return NextResponse.json(
        { error: "AI service is misconfigured. Please contact support." },
        { status: 500 },
      );
    }
    if (status === 529 || /overloaded|capacity/i.test(raw)) {
      return NextResponse.json(
        { error: "AI is overloaded. Please try again shortly." },
        { status: 503 },
      );
    }
    if (/insufficient.*credit|payment.*required|billing/i.test(raw)) {
      return NextResponse.json(
        { error: "AI service is out of credits. Please contact support." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Couldn't generate cards right now. Please try again." },
      { status: 500 },
    );
  }
}
