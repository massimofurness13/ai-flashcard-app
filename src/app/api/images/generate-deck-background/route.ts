import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { generateAndUploadFromCard } from "@/lib/stability-ai";

const CONCURRENCY = 3;

/**
 * Fire-and-forget image generation for all cards in a deck that don't
 * have an image yet. Returns immediately — generation continues on the
 * server regardless of whether the user stays on the page.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const isPro = await isProUser(auth.userId);
  if (!isPro) {
    return NextResponse.json(
      { error: "Pro subscription required for AI image generation" },
      { status: 403 }
    );
  }

  const { deckId } = await request.json();
  if (!deckId || typeof deckId !== "string") {
    return NextResponse.json({ error: "deckId is required" }, { status: 400 });
  }

  const deck = await prisma.deck.findUnique({
    where: { id: deckId, userId: auth.userId },
    select: { id: true },
  });
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const cards = await prisma.card.findMany({
    where: { deckId, imageUrl: null },
    select: { id: true, front: true, back: true },
  });

  if (cards.length === 0) {
    return NextResponse.json({ queued: 0, message: "All cards already have images" });
  }

  // Kick off generation in the background — the Node event loop on
  // Render's long-running server keeps processing after the response.
  processBatch(auth.userId, cards).catch((err) => {
    console.error("[background image] batch failed:", err);
  });

  return NextResponse.json({
    queued: cards.length,
    message: "Generation started. Images will appear as they're ready.",
  });
}

async function processBatch(
  userId: string,
  cards: { id: string; front: string; back: string }[]
) {
  // Simple concurrency limiter: always keep CONCURRENCY workers busy.
  // Cuts wall-clock time by ~3x vs sequential (Stability's 150req/10s
  // rate limit leaves ample headroom for 3 concurrent images).
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, cards.length) }, async () => {
    while (cursor < cards.length) {
      const card = cards[cursor++];
      try {
        const imageUrl = await generateAndUploadFromCard(userId, card.front, card.back);

        // updateMany with imageUrl: null guard is atomic — preserves
        // user edits (manual upload, card deletion) without a separate
        // re-check query. If the user uploaded their own image mid-run,
        // or deleted the card, the WHERE clause matches zero rows and
        // we skip the write.
        await prisma.card.updateMany({
          where: { id: card.id, imageUrl: null },
          data: { imageUrl },
        });
      } catch (err) {
        console.error(`[background image] card ${card.id}:`, err);
      }
    }
  });

  await Promise.all(workers);
}
