import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { masteryLevel, letterGrade, type LetterGrade } from "@/lib/sm2";

function generateDemoStats() {
  const heatmapData: { date: string; count: number }[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayNum = Math.floor(d.getTime() / 86400000);
    const hash = ((dayNum * 2654435761) >>> 0) % 100;

    let count = 0;
    if (i < 50) {
      count = hash < 5 ? 0 : 18 + (hash % 32);
    } else if (i < 150) {
      count = hash < 8 ? 0 : 12 + (hash % 28);
    } else if (i < 270) {
      count = hash < 15 ? 0 : 6 + (hash % 20);
    } else {
      count = hash < 35 ? 0 : 3 + (hash % 12);
    }
    heatmapData.push({ date: dateStr, count });
  }

  const calendarMonth: { date: string; count: number }[] = [];
  for (let day = 1; day <= 30; day++) {
    const dateStr = `2026-04-${day.toString().padStart(2, "0")}`;
    const h = ((day * 7 + 13) % 47);
    calendarMonth.push({
      date: dateStr,
      count: day === 5 || day === 22 ? 0 : 20 + (h % 30),
    });
  }

  const dailyCounts: { date: string; count: number }[] = [];
  const counts = [35, 0, 28, 42, 31, 38, 32];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyCounts.push({ date: d.toISOString().split("T")[0], count: counts[6 - i] });
  }

  return {
    totalCards: 482,
    cardsDueToday: 18,
    cardsReviewedInPeriod: 206,
    cardsReviewedToday: 32,
    dailyGoal: 25,
    goalHitToday: true,
    goalHitCelebrationShown: true,
    averageQuality: 4.2,
    streak: 47,
    longestStreak: 47,
    dailyCounts,
    heatmapData,
    deckStats: [
      { id: "1", name: "Spanish Vocab", emoji: "🇪🇸", totalCards: 156, masteryPercent: 78 },
      { id: "2", name: "Medical Terminology", emoji: "🏥", totalCards: 94, masteryPercent: 65 },
      { id: "3", name: "JavaScript Patterns", emoji: "⚡", totalCards: 82, masteryPercent: 91 },
      { id: "4", name: "World Capitals", emoji: "🌍", totalCards: 85, masteryPercent: 88 },
      { id: "5", name: "Art History", emoji: "🎨", totalCards: 65, masteryPercent: 42 },
    ],
    totalReviews: 4812,
    successRate: 89,
    activeDays: 134,
    bestDay: "2026-04-12",
    bestDayCount: 67,
    goalDaysLast30: 27,
    gradeHistogram: { A: 168, B: 142, C: 87, D: 38, F: 12, New: 35 },
    calendarMonth,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  if (searchParams.get("demo") === "1") {
    return NextResponse.json(generateDemoStats());
  }

  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const period = searchParams.get("period") || "7"; // days
  const days = parseInt(period, 10);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const now = new Date();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  yearAgo.setHours(0, 0, 0, 0);

  const [
    totalCards,
    cardsDueToday,
    reviewsInPeriod,
    allDecks,
    dailyReviews,
    yearlyReviews,
    // Lifetime review logs — two tiny fields per row, used for Active Days,
    // Best Day, Success Rate, Total Reviews. 20k rows at ~20 bytes = tolerable.
    lifetimeReviews,
    user,
  ] = await Promise.all([
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
      where: { userId: auth.userId, archivedAt: null },
      include: {
        _count: { select: { cards: true } },
        cards: {
          select: { easeFactor: true, repetitions: true },
        },
      },
    }),
    prisma.reviewLog.findMany({
      where: {
        reviewedAt: { gte: since },
        card: { deck: { userId: auth.userId } },
      },
      select: { reviewedAt: true },
      orderBy: { reviewedAt: "asc" },
    }),
    // 365-day window for the heatmap
    prisma.reviewLog.findMany({
      where: {
        reviewedAt: { gte: yearAgo },
        card: { deck: { userId: auth.userId } },
      },
      select: { reviewedAt: true },
    }),
    prisma.reviewLog.findMany({
      where: { card: { deck: { userId: auth.userId } } },
      select: { reviewedAt: true, quality: true },
    }),
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { dailyGoal: true, goalHitCelebrationShown: true },
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

  // Today's review count
  const cardsReviewedToday = yearlyReviews.filter(
    (r) => new Date(r.reviewedAt) >= startOfToday
  ).length;

  const dailyGoal = user?.dailyGoal ?? 25;
  const goalHitToday = cardsReviewedToday >= dailyGoal;
  const goalHitCelebrationShown = user?.goalHitCelebrationShown ?? false;

  // 365-day heatmap data
  const heatmapCounts: Record<string, number> = {};
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    heatmapCounts[d.toISOString().split("T")[0]] = 0;
  }
  for (const r of yearlyReviews) {
    const day = new Date(r.reviewedAt).toISOString().split("T")[0];
    if (heatmapCounts[day] !== undefined) {
      heatmapCounts[day]++;
    }
  }
  const heatmapData = Object.entries(heatmapCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Longest streak over the year
  const yearDaysWithReviews = new Set(
    yearlyReviews.map((r) => new Date(r.reviewedAt).toISOString().split("T")[0])
  );
  let longestStreak = 0;
  let running = 0;
  for (const { date } of heatmapData) {
    if (yearDaysWithReviews.has(date)) {
      running++;
      if (running > longestStreak) longestStreak = running;
    } else {
      running = 0;
    }
  }

  // --- Lifetime aggregates (Active Days, Best Day, Success Rate, Goal Days 30d) ---
  const lifetimeByDay = new Map<string, number>();
  let lifetimeSuccessful = 0;
  for (const r of lifetimeReviews) {
    const day = new Date(r.reviewedAt).toISOString().split("T")[0];
    lifetimeByDay.set(day, (lifetimeByDay.get(day) || 0) + 1);
    // Quality 3+ counts as "knew it" (Good or Easy in SM-2 terms)
    if (r.quality >= 3) lifetimeSuccessful++;
  }
  const activeDays = lifetimeByDay.size;
  let bestDay: string | null = null;
  let bestDayCount = 0;
  for (const [day, count] of lifetimeByDay) {
    if (count > bestDayCount) {
      bestDayCount = count;
      bestDay = day;
    }
  }
  const totalReviews = lifetimeReviews.length;
  const successRate =
    totalReviews > 0 ? Math.round((lifetimeSuccessful / totalReviews) * 100) : 0;

  // Goal days in last 30: how many of the last 30 days hit dailyGoal
  let goalDaysLast30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().split("T")[0];
    if ((lifetimeByDay.get(day) || 0) >= dailyGoal) goalDaysLast30++;
  }

  // --- Grade histogram across all cards ---
  const gradeHistogram: Record<LetterGrade, number> = {
    New: 0,
    F: 0,
    D: 0,
    C: 0,
    B: 0,
    A: 0,
  };
  for (const deck of allDecks) {
    for (const card of deck.cards) {
      const m = masteryLevel({
        easeFactor: card.easeFactor,
        interval: 0,
        repetitions: card.repetitions,
      });
      gradeHistogram[letterGrade(m)]++;
    }
  }

  // --- Calendar month view (current month) ---
  // Array of { date: "YYYY-MM-DD", count } for every day of the current month.
  const calendarMonth: { date: string; count: number }[] = [];
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthCursor = new Date(monthStart);
  while (monthCursor.getMonth() === monthStart.getMonth()) {
    const day = monthCursor.toISOString().split("T")[0];
    calendarMonth.push({ date: day, count: lifetimeByDay.get(day) || 0 });
    monthCursor.setDate(monthCursor.getDate() + 1);
  }

  return NextResponse.json({
    totalCards,
    cardsDueToday,
    cardsReviewedInPeriod: reviewsInPeriod.length,
    cardsReviewedToday,
    dailyGoal,
    goalHitToday,
    goalHitCelebrationShown,
    averageQuality: Math.round(avgQuality * 10) / 10,
    streak,
    longestStreak,
    dailyCounts: Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .reverse(),
    heatmapData,
    deckStats,
    // New engagement + response-quality aggregates
    totalReviews,
    successRate,
    activeDays,
    bestDay,
    bestDayCount,
    goalDaysLast30,
    gradeHistogram,
    calendarMonth,
  });
}
