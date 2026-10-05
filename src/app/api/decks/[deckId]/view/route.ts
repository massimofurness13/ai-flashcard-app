import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isProUser, canViewAiImages } from "@/lib/subscription";
import { masteryLevel, letterGrade } from "@/lib/sm2";
export async function GET(_request: Request, { params }: { params: Promise<{ deckId: string }> }) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId;
  const { deckId } = await params;
  const deck = await prisma.deck.findUnique({
    where: { id: deckId, userId },
    include: {
      cards: { orderBy: { position: "asc" } },
      folder: true,
      _count: { select: { cards: true } },
    },
  });

  if (!deck) {
    return Response.json({ error: "Pack not found" }, { status: 404 });
  }

  // Compute per-card mastery and overall grade
  const cardMasteries = deck.cards.map((card) => ({
    mastery: masteryLevel({
      easeFactor: card.easeFactor,
      interval: card.interval,
      repetitions: card.repetitions,
    }),
  }));

  const avgMastery =
    cardMasteries.length > 0
      ? Math.round(
          cardMasteries.reduce((sum, c) => sum + c.mastery, 0) / cardMasteries.length
        )
      : 0;

  const overallGrade = letterGrade(avgMastery);

  // Grade distribution for bar chart
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0, New: 0 };
  for (const cm of cardMasteries) {
    gradeDistribution[letterGrade(cm.mastery)]++;
  }

  const [isPro, canView, user] = await Promise.all([
    isProUser(userId),
    canViewAiImages(userId),
    // Learning language drives the voice fallback when downloading a
    // pack whose deck has no explicit front/back language codes.
    prisma.user.findUnique({
      where: { id: userId },
      select: { learningLanguage: true },
    }),
  ]);

  return Response.json({ deck, overallGrade, avgMastery, gradeDistribution, isPro, canViewAiImages: canView, learningLanguage: user?.learningLanguage ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

