import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { ReviewConfig } from "./review-config";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const userId = await ensureUser();

  const now = new Date();

  const decks = await prisma.deck.findMany({
    where: { userId },
    include: {
      _count: { select: { cards: true } },
    },
    orderBy: { name: "asc" },
  });

  const decksWithDue = await Promise.all(
    decks.map(async (deck) => {
      const dueCount = await prisma.card.count({
        where: { deckId: deck.id, nextReviewAt: { lte: now } },
      });
      return { ...deck, dueCount };
    })
  );

  const totalDue = decksWithDue.reduce((sum, d) => sum + d.dueCount, 0);

  return (
    <ReviewConfig decks={decksWithDue} totalDue={totalDue} />
  );
}
