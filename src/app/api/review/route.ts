import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sm2, masteryLevel } from "@/lib/sm2";
import { requireAuth } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";

type StudyFilter = "due" | "random" | "created" | "mastery" | "recent" | "alpha";

const VALID_FILTERS: StudyFilter[] = ["due", "random", "created", "mastery", "recent", "alpha"];

// GET /api/review — fetch cards for a study session with a chosen filter.
// Despite the route name, SM-2 runs on EVERY rating regardless of filter,
// so "study" and "review" use the same endpoint.
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const searchParams = request.nextUrl.searchParams;
  const deckIds = searchParams.get("deckIds");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 500);
  const recencyCutoffDays = parseInt(searchParams.get("recencyCutoff") || "0", 10);
  const filterParam = searchParams.get("filter") || "due";
  const filter: StudyFilter = VALID_FILTERS.includes(filterParam as StudyFilter)
    ? (filterParam as StudyFilter)
    : "due";
  // Tag filter — AND-semantics: a card must have ALL listed tags to match.
  // Tag comparison is case-insensitive so "Spanish" and "spanish" merge.
  const tagFilter = (searchParams.get("tags") || "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const now = new Date();

  const where: Prisma.CardWhereInput = {
    deck: { userId: auth.userId },
  };

  if (deckIds) {
    where.deckId = { in: deckIds.split(",") };
  }

  // "Due" filter: only cards whose nextReviewAt has passed
  if (filter === "due") {
    where.nextReviewAt = { lte: now };
  }

  // Recency cutoff (optional) — skip cards reviewed too recently
  if (recencyCutoffDays > 0) {
    const cutoffDate = new Date(now.getTime() - recencyCutoffDays * 86400000);
    where.reviews = { none: { reviewedAt: { gte: cutoffDate } } };
  }

  const orderBy: Prisma.CardOrderByWithRelationInput =
    filter === "due"
      ? { nextReviewAt: "asc" }
      : filter === "created"
        ? { createdAt: "asc" }
        : filter === "recent"
          ? { createdAt: "desc" }
          : filter === "alpha"
            ? { front: "asc" }
            : { nextReviewAt: "asc" }; // fallback; random & mastery handled below

  // When a tag filter is active we over-fetch so we can JS-filter without
  // starving the session of cards. Capped to avoid pulling the whole deck.
  const fetchMultiplier =
    tagFilter.length > 0 ? 10 : filter === "random" || filter === "mastery" ? 4 : 1;
  const fetchLimit = Math.min(limit * fetchMultiplier, 2000);

  let cards = await prisma.card.findMany({
    where,
    include: {
      deck: { select: { id: true, name: true, emoji: true, frontVoice: true, backVoice: true } },
    },
    orderBy,
    take: fetchLimit,
  });

  if (tagFilter.length > 0) {
    cards = cards.filter((c) => {
      const cardTags = (c.tags || "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      return tagFilter.every((t) => cardTags.includes(t));
    });
  }

  if (filter === "random") {
    // Fisher-Yates shuffle
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    cards = cards.slice(0, limit);
  } else if (filter === "mastery") {
    // Sort by computed mastery ascending (lowest mastery = most needs practice)
    cards.sort(
      (a, b) =>
        masteryLevel({
          easeFactor: a.easeFactor,
          interval: a.interval,
          repetitions: a.repetitions,
        }) -
        masteryLevel({
          easeFactor: b.easeFactor,
          interval: b.interval,
          repetitions: b.repetitions,
        })
    );
    cards = cards.slice(0, limit);
  } else if (cards.length > limit) {
    // Catch-all trim for filters that weren't already sliced (hits when
    // we over-fetched for tag filtering).
    cards = cards.slice(0, limit);
  }

  const totalAvailable = await prisma.card.count({ where });

  return NextResponse.json({ cards, totalDue: totalAvailable, total: totalAvailable });
}

// POST /api/review — submit a review rating (SM-2 update)
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
