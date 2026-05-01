import { prisma } from "@/lib/db";
import { getOptionalUser, ensureUser } from "@/lib/auth";
import { HomePage } from "./home-client";
import { LandingPage } from "./landing";
import { masteryLevel, letterGrade } from "@/lib/sm2";

export const dynamic = "force-dynamic";

async function computeDeckGrade(deckId: string): Promise<string> {
  const cards = await prisma.card.findMany({
    where: { deckId },
    select: { easeFactor: true, interval: true, repetitions: true },
  });
  if (cards.length === 0) return "New";
  const avg = Math.round(
    cards.reduce((sum, c) => sum + masteryLevel(c), 0) / cards.length
  );
  return letterGrade(avg);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const user = await getOptionalUser();
  const { preview } = await searchParams;

  // Logged-out visitors always see the marketing landing. Logged-in
  // users normally get the real app — but ?preview=landing forces
  // the marketing page to render even when authenticated, which is
  // how you (and anyone you share the URL with) review the landing
  // copy without having to sign out.
  if (!user || preview === "landing") {
    return <LandingPage />;
  }

  const userId = await ensureUser();

  const [folders, unfolderedDecks, lastReviewedRows] = await Promise.all([
    prisma.folder.findMany({
      where: { userId },
      include: {
        decks: {
          // Empty packs are hidden from the library: a pack only counts
          // as "real" once it has at least one card. Anyone landing on
          // an empty pack via direct URL still sees it (the edit page
          // works fine), but the home/library list is kept clean of
          // orphan packs from failed bulk saves or abandoned creation
          // flows.
          where: { archivedAt: null, cards: { some: {} } },
          include: { _count: { select: { cards: true } } },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.deck.findMany({
      where: {
        folderId: null,
        userId,
        archivedAt: null,
        cards: { some: {} },
      },
      include: { _count: { select: { cards: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    // Last-studied timestamp per deck. Raw SQL is the least-rows option —
    // alternatives would pull every card + its latest review.
    prisma.$queryRaw<Array<{ deckId: string; lastAt: Date }>>`
      SELECT c."deckId" AS "deckId", MAX(rl."reviewedAt") AS "lastAt"
      FROM "ReviewLog" rl
      INNER JOIN "Card" c ON rl."cardId" = c.id
      INNER JOIN "Deck" d ON c."deckId" = d.id
      WHERE d."userId" = ${userId}
      GROUP BY c."deckId"
    `,
  ]);

  const lastReviewedMap = new Map<string, Date>(
    lastReviewedRows.map((r) => [r.deckId, r.lastAt])
  );

  const foldersWithGrades = await Promise.all(
    folders.map(async (folder) => ({
      ...folder,
      decks: await Promise.all(
        folder.decks.map(async (deck) => ({
          ...deck,
          grade: await computeDeckGrade(deck.id),
          lastStudiedAt: lastReviewedMap.get(deck.id)?.toISOString() ?? null,
        }))
      ),
    }))
  );

  const unfolderedWithGrades = await Promise.all(
    unfolderedDecks.map(async (deck) => ({
      ...deck,
      grade: await computeDeckGrade(deck.id),
      lastStudiedAt: lastReviewedMap.get(deck.id)?.toISOString() ?? null,
    }))
  );

  const totalCards = await prisma.card.count({
    where: { deck: { userId } },
  });

  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      dailyGoal: true,
      goalHitCelebrationShown: true,
    },
  });
  const displayName = userData?.name || userData?.email?.split("@")[0] || "there";
  const dailyGoal = userData?.dailyGoal ?? 25;
  const goalHitCelebrationShown = userData?.goalHitCelebrationShown ?? false;

  // Engagement: today's review count + streak (consecutive days)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 60); // 60 days is plenty to compute a streak
  yearAgo.setHours(0, 0, 0, 0);

  const recentReviews = await prisma.reviewLog.findMany({
    where: {
      reviewedAt: { gte: yearAgo },
      card: { deck: { userId } },
    },
    select: { reviewedAt: true },
  });

  const cardsReviewedToday = recentReviews.filter(
    (r) => r.reviewedAt >= startOfToday
  ).length;

  const reviewDays = new Set(
    recentReviews.map((r) => r.reviewedAt.toISOString().split("T")[0])
  );
  let streak = 0;
  const checkDate = new Date();
  while (true) {
    const dayStr = checkDate.toISOString().split("T")[0];
    if (reviewDays.has(dayStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (streak === 0) {
      // Allow today to have zero so yesterday-and-back still counts
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterdayStr = checkDate.toISOString().split("T")[0];
      if (reviewDays.has(yesterdayStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break;
    } else {
      break;
    }
  }

  return (
    <HomePage
      folders={foldersWithGrades}
      unfolderedDecks={unfolderedWithGrades}
      totalCards={totalCards}
      userName={displayName}
      cardsReviewedToday={cardsReviewedToday}
      dailyGoal={dailyGoal}
      streak={streak}
      goalHitCelebrationShown={goalHitCelebrationShown}
    />
  );
}
