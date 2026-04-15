import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { ReviewConfig } from "./review-config";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const userId = await ensureUser();

  const decks = await prisma.deck.findMany({
    where: { userId },
    include: {
      _count: { select: { cards: true } },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const decksWithDue = await Promise.all(
    decks.map(async (deck) => {
      const dueCount = await prisma.card.count({
        where: { deckId: deck.id, nextReviewAt: { lte: now } },
      });
      const lastReview = await prisma.reviewLog.findFirst({
        where: { card: { deckId: deck.id } },
        orderBy: { reviewedAt: "desc" },
        select: { reviewedAt: true },
      });
      return {
        ...deck,
        dueCount,
        lastReviewedAt: lastReview?.reviewedAt.toISOString() || null,
      };
    })
  );

  const totalDue = decksWithDue.reduce((sum, d) => sum + d.dueCount, 0);

  return (
    <ReviewConfig decks={decksWithDue} totalDue={totalDue} />
  );
}
