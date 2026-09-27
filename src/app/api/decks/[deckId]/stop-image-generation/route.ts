import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * Stop background image generation for a deck.
 *
 * "Stop" means: clear `imageTier` on every card in the deck that
 * doesn't yet have an `imageUrl`. The cron worker filters its queue
 * by `imageTier IS NOT NULL`, so blanking it removes those cards
 * from consideration entirely. The cards keep their text + audio
 * + position; only the image-generation intent is dropped.
 *
 * Used when:
 *   - A user wants to halt an in-flight bulk generation (UI button)
 *   - A user with stranded cards from an old session decides they
 *     don't want to spend credits to finish illustrating them
 *
 * Resuming is the user's choice — clicking "Generate the rest" on
 * the deck page (or running the bulk slider on /cards/edit) sets
 * imageTier again and the cards re-enter the queue.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { deckId } = await params;

  // Verify ownership before mutating — a user can only stop generation
  // on their own decks. updateMany handles "deck not found" naturally
  // by matching zero rows, but adding the deck check returns a clean
  // 404 instead of a misleading 200.
  const deck = await prisma.deck.findUnique({
    where: { id: deckId, userId: auth.userId },
    select: { id: true },
  });
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  // Withdraw pending intent, but retain a running worker's lease. An
  // image already claimed may finish; clearing its lock would allow a
  // second request to start another paid generation for the same card.
  const result = await prisma.card.updateMany({
    where: {
      deckId,
      imageUrl: null,
      imageTier: { not: null },
    },
    data: {
      imageTier: null,
      imageGenError: null,
    },
  });

  return NextResponse.json({ stopped: result.count });
}
