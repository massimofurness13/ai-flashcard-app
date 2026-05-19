import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { type ImageTier } from "@/lib/image-gen";
import { getQuotaState, TIER_COSTS } from "@/lib/image-quota";
import { processQueue } from "@/app/api/cron/process-image-queue/route";

// One inline batch (~50s) gives the user instant first-page feedback;
// the rest is drained by the per-minute cron at /api/cron/process-image-queue.
export const maxDuration = 60;

/**
 * Trigger image generation for a deck.
 *
 * This used to spawn a fire-and-forget worker pool. That pattern dies
 * on Vercel — the function is terminated the moment the response is
 * returned, stranding cards mid-loop (the "stops at 53/102" / "0/49"
 * bug). Replaced with a persisted queue: cards with imageUrl IS NULL
 * ARE the queue, drained by the cron worker at /api/cron/process-image-queue.
 *
 * This route now:
 *   1. Validates auth, Pro status, and deck ownership.
 *   2. Sets imageTier on each pending card so the worker honours the
 *      user's quick/premium mix.
 *   3. Affordability check — caps the queue at what the user can pay for.
 *   4. Runs ONE inline batch (best-effort) so the first few images
 *      appear immediately rather than waiting for the next cron tick.
 *   5. Returns. The cron drains the rest, durably, even if this
 *      function gets killed.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // No Pro gate — free users can spend their lifetime free credits
  // on bulk image generation just like Pro users spend subscription
  // credits. The affordability cap below trims the queue to what
  // the caller can actually pay for, so a free user with 25 credits
  // won't kick off a 100-card job they can't finish.

  const body = await request.json();
  const { deckId } = body;
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

  // Pull the pending cards in deterministic order so positional tier
  // assignment (first N premium, rest quick) is stable across calls.
  const cards = await prisma.card.findMany({
    where: { deckId, imageUrl: null },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  if (cards.length === 0) {
    return NextResponse.json({ queued: 0, message: "All cards already have images" });
  }

  // Affordability: walk the assignments in user-intent order, drop the
  // tail we can't pay for. Premium is 5x quick, so order matters.
  const quota = await getQuotaState(auth.userId);
  let remaining = quota.totalRemaining;
  const affordable: { id: string; tier: ImageTier }[] = [];
  for (let i = 0; i < cards.length; i++) {
    const cardTier: ImageTier =
      premiumCount > 0 && i < premiumCount ? "premium" : tier;
    const cost = TIER_COSTS[cardTier];
    if (remaining < cost) break;
    remaining -= cost;
    affordable.push({ id: cards[i].id, tier: cardTier });
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

  // Stamp the tier on each queued card AND reset queue-state fields so
  // a previously-failed card (imageGenAttempts at max) gets another
  // shot when the user explicitly re-triggers generation.
  await Promise.all(
    affordable.map(({ id, tier: t }) =>
      prisma.card.update({
        where: { id },
        data: {
          imageTier: t,
          imageGenAttempts: 0,
          imageGenError: null,
          imageGenLockedAt: null,
        },
      }),
    ),
  );

  // Best-effort inline batch — gives the user instant first-page
  // feedback. Wrapped in a Promise.race against a short deadline so a
  // slow run doesn't block the response. The cron drains everything
  // we miss here, so a partial inline result is fine.
  const inlineDeadline = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 25_000),
  );
  await Promise.race([processQueue().catch(() => null), inlineDeadline]);

  const skipped = cards.length - affordable.length;
  return NextResponse.json({
    queued: affordable.length,
    total: cards.length,
    premiumCount: Math.min(premiumCount, affordable.length),
    message:
      skipped > 0
        ? `Generating ${affordable.length} images with your remaining credits. ${skipped} cards will need more credits.`
        : "Generation started. Images will appear as they're ready.",
  });
}
