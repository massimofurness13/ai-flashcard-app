import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { notFound } from "next/navigation";
import { DeckView } from "./deck-view";
import { masteryLevel, letterGrade } from "@/lib/sm2";

export const dynamic = "force-dynamic";

export default async function DeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const userId = await ensureUser();
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
    notFound();
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

  const isPro = await isProUser(userId);

  return (
    <DeckView
      deck={deck}
      overallGrade={overallGrade}
      avgMastery={avgMastery}
      gradeDistribution={gradeDistribution}
      isPro={isPro}
    />
  );
}
