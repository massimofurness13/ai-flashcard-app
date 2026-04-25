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
  // Default tier (when caller doesn't pass a mix) is `quick` — cheaper
  // and what most "fill in the rest" cases want. `premiumCount` lets
  // the caller request that the FIRST N cards (in DB insertion order)
  // be processed as premium and the remainder as quick. Used by the
  // unified create flow to honour the user's silver/gold mix when
  // generation is handed off mid-session.
  const tier: ImageTier = body.tier === "premium" ? "premium" : "quick";
  const premiumCountRaw = Number(body.premiumCount);
  const premiumCount =
    Number.isFinite(premiumCountRaw) && premiumCountRaw > 0
      ? Math.floor(premiumCountRaw)
      : 0;

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

  // Ordering matters — premium tier is assigned positionally (the
  // first `premiumCount` cards in this list become premium, the rest
  // are quick). Use createdAt + id so ties are deterministic across
  // requests.
  const cards = await prisma.card.findMany({
    where: { deckId, imageUrl: null },
    select: { id: true, front: true, back: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  if (cards.length === 0) {
    return NextResponse.json({ queued: 0, message: "All cards already have images" });
  }

  // Build the per-card tier assignment up-front so the worker pool
  // doesn't need to know about the boundary. If no premiumCount is
  // passed, every card uses the legacy single-tier path.
  const assignments: { id: string; front: string; back: string; tier: ImageTier }[] =
    premiumCount > 0
      ? cards.map((c, i) => ({ ...c, tier: i < premiumCount ? "premium" : "quick" }))
      : cards.map((c) => ({ ...c, tier }));

  // Affordability check: walk the assignments in order, keep cards
  // we can afford, drop the tail we can't. Premium cards are 5x more
  // expensive than quick, so the order matters — burning premium
  // credits on the first cards and falling back to quick later is
  // exactly what the user signed up for in the slider.
  const quota = await getQuotaState(auth.userId);
  let remaining = quota.totalRemaining;
  const affordable: typeof assignments = [];
  for (const a of assignments) {
    const cost = TIER_COSTS[a.tier];
    if (remaining < cost) break;
    remaining -= cost;
    affordable.push(a);
  }

  if (affordable.length === 0) {
    return NextResponse.json(
      {
        queued: 0,
        total: cards.length,
        message: "Not enough credits to generate images.",
      },
      { status: 200 }
    );
  }

  processBatch(auth.userId, affordable).catch((err) => {
    console.error("[background image] batch failed:", err);
  });

  const skipped = cards.length - affordable.length;
  return NextResponse.json({
    queued: affordable.length,
    total: cards.length,
    premiumCount: Math.min(premiumCount, affordable.length),
    message: skipped > 0
      ? `Generating ${affordable.length} images with your remaining credits. ${skipped} cards will need more credits.`
      : "Generation started. Images will appear as they're ready.",
  });
}

async function processBatch(
  userId: string,
  cards: { id: string; front: string; back: string; tier: ImageTier }[],
) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, cards.length) }, async () => {
    while (cursor < cards.length) {
      const card = cards[cursor++];

      const consumed = await consumeImageCredit(userId, card.tier);
      if (!consumed.ok) return;

      try {
        const imageUrl = await generateAndUploadImage(
          userId,
          card.front,
          card.back,
          card.tier
        );
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
