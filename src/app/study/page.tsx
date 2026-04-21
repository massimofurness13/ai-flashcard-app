import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { StudyConfig } from "./study-config";

export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const userId = await ensureUser();

  const [decks, lastReviewedRows] = await Promise.all([
    prisma.deck.findMany({
      where: { userId, archivedAt: null },
      include: { _count: { select: { cards: true } } },
      orderBy: { name: "asc" },
    }),
    // Last-reviewed per deck — drives the "Active in last N days" quick-select.
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

  const decksWithMeta = decks.map((d) => ({
    ...d,
    lastReviewedAt: lastReviewedMap.get(d.id)?.toISOString() ?? null,
  }));

  return <StudyConfig decks={decksWithMeta} />;
}
