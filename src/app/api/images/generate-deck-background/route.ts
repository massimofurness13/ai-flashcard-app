import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { generateAndUploadImage, type ImageTier } from "@/lib/image-gen";
import {
  consumeImageCredit,
  refundImageCredit,
  getQuotaState,
  TIER_COSTS,
} from "@/lib/image-quota";

const CONCURRENCY = 3;

/**
 * Fire-and-forget image generation for all cards in a deck that don't
 * have an image yet. Accepts tier (quick | premium). Returns immediately —
 * generation continues on the server regardless of whether the user stays.
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

  const body = await request.json();
  const { deckId } = body;
  const tier: ImageTier = body.tier === "premium" ? "premium" : "quick";

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

  const quota = await getQuotaState(auth.userId);
  const costPerCard = TIER_COSTS[tier];
  const affordableCount = Math.floor(quota.totalRemaining / costPerCard);
  const willProcess = Math.min(cards.length, affordableCount);

  processBatch(auth.userId, cards.slice(0, willProcess), tier).catch((err) => {
    console.error("[background image] batch failed:", err);
  });

  return NextResponse.json({
    queued: willProcess,
    total: cards.length,
    tier,
    creditsPerCard: costPerCard,
    message: willProcess < cards.length
      ? `Generating ${willProcess} images with your remaining credits. ${cards.length - willProcess} cards will need more credits.`
      : "Generation started. Images will appear as they're ready.",
  });
}

async function processBatch(
  userId: string,
  cards: { id: string; front: string; back: string }[],
  tier: ImageTier
) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, cards.length) }, async () => {
    while (cursor < cards.length) {
      const card = cards[cursor++];

      const consumed = await consumeImageCredit(userId, tier);
      if (!consumed.ok) return;

      try {
        const imageUrl = await generateAndUploadImage(userId, card.front, card.back, tier);
        await prisma.card.updateMany({
          where: { id: card.id, imageUrl: null },
          data: { imageUrl },
        });
      } catch (err) {
        await refundImageCredit(userId, consumed.source, consumed.amountUsed);
        console.error(`[background image] card ${card.id}:`, err);
      }
    }
  });

  await Promise.all(workers);
}
