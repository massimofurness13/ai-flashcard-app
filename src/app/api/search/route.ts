import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * Global search across the user's content. Three result categories:
 * - decks matching the query by name or description
 * - cards matching by front / back / hint / tags
 * - tags matching by name (with count)
 *
 * Empty query short-circuits with blank results so the page can show
 * "Browse by tag" / recent decks without firing a useless DB call.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const q = (request.nextUrl.searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ decks: [], cards: [], tags: [] });
  }

  const [decks, cards, allTaggedCards] = await Promise.all([
    prisma.deck.findMany({
      where: {
        userId: auth.userId,
        archivedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { _count: { select: { cards: true } } },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.card.findMany({
      where: {
        deck: { userId: auth.userId, archivedAt: null },
        OR: [
          { front: { contains: q, mode: "insensitive" } },
          { back: { contains: q, mode: "insensitive" } },
          { hint: { contains: q, mode: "insensitive" } },
          { tags: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        deck: { select: { id: true, name: true, emoji: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    // Gather every tag the user has so we can return ones matching q
    prisma.card.findMany({
      where: { deck: { userId: auth.userId }, tags: { not: null } },
      select: { tags: true },
    }),
  ]);

  // Tag aggregation + filter
  const tagCounts = new Map<string, number>();
  for (const c of allTaggedCards) {
    if (!c.tags) continue;
    for (const raw of c.tags.split(",")) {
      const tag = raw.trim();
      if (!tag) continue;
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  const qLower = q.toLowerCase();
  const tags = Array.from(tagCounts.entries())
    .filter(([name]) => name.toLowerCase().includes(qLower))
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  return NextResponse.json({ decks, cards, tags });
}
