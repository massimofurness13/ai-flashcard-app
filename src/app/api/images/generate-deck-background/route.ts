import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { generateAndUploadFromCard } from "@/lib/stability-ai";
import {
  consumeImageCredit,
  refundImageCredit,
  getQuotaState,
} from "@/lib/image-quota";

const CONCURRENCY = 3;

/**
 * Fire-and-forget image generation for all cards in a deck that don't
 * have an image yet. Returns immediately — generation continues on the
 * server regardless of whether the user stays on the page.
 *
 * Each card consumes one quota credit. If the user runs out mid-batch,
 * remaining cards are skipped silently — they can top up and run again.
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

  // Tell the user upfront how many cards can actually be generated
  const quota = await getQuotaState(auth.userId);
  const willProcess = Math.min(cards.length, quota.totalRemaining);

  processBatch(auth.userId, cards).catch((err) => {
    console.error("[background image] batch failed:", err);
  });

  return NextResponse.json({
    queued: willProcess,
    total: cards.length,
    quotaLimit: quota.totalRemaining,
    message: willProcess < cards.length
      ? `Generating ${willProcess} images with your remaining quota. ${cards.length - willProcess} cards will need more credits.`
      : "Generation started. Images will appear as they're ready.",
  });
}

async function processBatch(
  userId: string,
  cards: { id: string; front: string; back: string }[]
) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, cards.length) }, async () => {
    while (cursor < cards.length) {
      const card = cards[cursor++];

      // Consume one credit before generating — stop if user ran out
      const consumed = await consumeImageCredit(userId);
      if (!consumed.ok) {
        // Out of quota — skip remaining cards. User can top up and re-run.
        return;
      }

      try {
        const imageUrl = await generateAndUploadFromCard(userId, card.front, card.back);
        await prisma.card.updateMany({
          where: { id: card.id, imageUrl: null },
          data: { imageUrl },
        });
      } catch (err) {
        // Refund credit since generation failed
        await refundImageCredit(userId, consumed.source);
        console.error(`[background image] card ${card.id}:`, err);
      }
    }
  });

  await Promise.all(workers);
}
