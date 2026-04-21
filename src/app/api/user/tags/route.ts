import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * Return every distinct tag used across the user's cards, with usage
 * counts — backs the tag chip autocomplete and the study-config tag
 * filter. Tags live as a comma-separated string on Card.tags, so we
 * split + aggregate in JS.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const cards = await prisma.card.findMany({
    where: { deck: { userId: auth.userId }, tags: { not: null } },
    select: { tags: true },
  });

  const counts = new Map<string, number>();
  for (const c of cards) {
    if (!c.tags) continue;
    for (const raw of c.tags.split(",")) {
      const tag = raw.trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  const tags = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ tags });
}
