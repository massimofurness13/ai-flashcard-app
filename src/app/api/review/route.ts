import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sm2 } from "@/lib/sm2";
import { requireAuth } from "@/lib/auth";

// GET /api/review — get cards due for review
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const searchParams = request.nextUrl.searchParams;
  const deckIds = searchParams.get("deckIds");
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const recencyCutoffDays = parseInt(searchParams.get("recencyCutoff") || "0", 10);

  const now = new Date();

  const where: Record<string, unknown> = {
    nextReviewAt: { lte: now },
    deck: { userId: auth.userId },
  };

  if (deckIds) {
    where.deckId = { in: deckIds.split(",") };
  }

  // Filter out individual cards reviewed within the recency cutoff
  if (recencyCutoffDays > 0) {
    const cutoffDate = new Date(now.getTime() - recencyCutoffDays * 86400000);
    where.reviews = {
      none: {
        reviewedAt: { gte: cutoffDate },
      },
    };
  }

  const cards = await prisma.card.findMany({
    where,
    include: { deck: { select: { id: true, name: true, emoji: true, frontVoice: true, backVoice: true } } },
    orderBy: { nextReviewAt: "asc" },
    take: limit,
  });

  const totalDue = await prisma.card.count({ where });

  return NextResponse.json({ cards, totalDue });
}

// POST /api/review — submit a review rating
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { cardId, quality } = body;

  if (!cardId || quality === undefined) {
    return NextResponse.json(
      { error: "cardId and quality are required" },
      { status: 400 }
    );
  }

  // Verify card ownership through deck
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: { select: { userId: true } } },
  });

  if (!card || card.deck.userId !== auth.userId) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const result = sm2(quality, {
    easeFactor: card.easeFactor,
    interval: card.interval,
    repetitions: card.repetitions,
  });

  const [updatedCard] = await Promise.all([
    prisma.card.update({
      where: { id: cardId },
      data: {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReviewAt: result.nextReviewAt,
      },
    }),
    prisma.reviewLog.create({
      data: {
        cardId,
        quality,
        easeFactor: result.easeFactor,
        interval: result.interval,
      },
    }),
  ]);

  return NextResponse.json({
    card: updatedCard,
    nextReviewAt: result.nextReviewAt,
    interval: result.interval,
  });
}
