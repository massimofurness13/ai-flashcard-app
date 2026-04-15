import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get("period") || "7"; // days
  const days = parseInt(period, 10);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const now = new Date();

  const [totalCards, cardsDueToday, reviewsInPeriod, allDecks, dailyReviews] =
    await Promise.all([
      prisma.card.count({
        where: { deck: { userId: auth.userId } },
      }),
      prisma.card.count({
        where: { deck: { userId: auth.userId }, nextReviewAt: { lte: now } },
      }),
      prisma.reviewLog.findMany({
        where: {
          reviewedAt: { gte: since },
          card: { deck: { userId: auth.userId } },
        },
        select: { quality: true, reviewedAt: true },
      }),
      prisma.deck.findMany({
        where: { userId: auth.userId },
        include: {
          _count: { select: { cards: true } },
          cards: {
            select: { easeFactor: true, repetitions: true },
          },
        },
      }),
      // Get review counts grouped by day
      prisma.reviewLog.findMany({
        where: {
          reviewedAt: { gte: since },
          card: { deck: { userId: auth.userId } },
        },
        select: { reviewedAt: true },
        orderBy: { reviewedAt: "asc" },
      }),
    ]);

  // Calculate average quality
  const avgQuality =
    reviewsInPeriod.length > 0
      ? reviewsInPeriod.reduce((sum, r) => sum + r.quality, 0) /
        reviewsInPeriod.length
      : 0;

  // Calculate streak (consecutive days with at least one review)
  const reviewDays = new Set(
    dailyReviews.map((r) => new Date(r.reviewedAt).toISOString().split("T")[0])
  );
  let streak = 0;
  const checkDate = new Date();
  while (true) {
    const dayStr = checkDate.toISOString().split("T")[0];
    if (reviewDays.has(dayStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Allow today to not have reviews yet
      if (streak === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
        const yesterdayStr = checkDate.toISOString().split("T")[0];
        if (reviewDays.has(yesterdayStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
      }
      break;
    }
  }

  // Daily review counts for chart
  const dailyCounts: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyCounts[d.toISOString().split("T")[0]] = 0;
  }
  for (const r of dailyReviews) {
    const day = new Date(r.reviewedAt).toISOString().split("T")[0];
    if (dailyCounts[day] !== undefined) {
      dailyCounts[day]++;
    }
  }

  // Per-deck mastery
  const deckStats = allDecks.map((deck) => {
    const mastered = deck.cards.filter(
      (c) => c.repetitions >= 3 && c.easeFactor >= 2.0
    ).length;
    const total = deck._count.cards;
    return {
      id: deck.id,
      name: deck.name,
      emoji: deck.emoji,
      totalCards: total,
      masteryPercent: total > 0 ? Math.round((mastered / total) * 100) : 0,
    };
  });

  return NextResponse.json({
    totalCards,
    cardsDueToday,
    cardsReviewedInPeriod: reviewsInPeriod.length,
    averageQuality: Math.round(avgQuality * 10) / 10,
    streak,
    dailyCounts: Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .reverse(),
    deckStats,
  });
}
