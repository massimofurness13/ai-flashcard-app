import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/onboarding/starter?lang=es&level=A1
 *
 * Looks up the canonical starter pack for the (language, level)
 * combo and returns metadata + up to 3 sample cards so the client
 * can show the user what they're about to clone before they commit.
 *
 * Returns 200 with `{ exists: false }` if there's no pack for this
 * combo — keeps the client logic simple (no 404 special-casing).
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const language = searchParams.get("lang");
  const level = searchParams.get("level");

  if (!language || !level) {
    return NextResponse.json(
      { error: "lang and level query params are required" },
      { status: 400 }
    );
  }

  const starter = await prisma.starterPack.findUnique({
    where: { language_level: { language, level } },
    include: {
      cards: { orderBy: { position: "asc" } },
    },
  });

  if (!starter) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    name: starter.name,
    emoji: starter.emoji,
    description: starter.description,
    cardCount: starter.cards.length,
    sampleCards: starter.cards.slice(0, 3).map((c) => ({
      front: c.front,
      back: c.back,
    })),
  });
}
