import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAndUploadImage, type ImageTier } from "@/lib/image-gen";
import {
  consumeImageCredit,
  refundImageCredit,
} from "@/lib/image-quota";

// Vercel function config:
//   60s gives us comfortable headroom — a single FLUX schnell call is
//   <2s, but the validation round-trip + Supabase upload + occasional
//   slow path can push past 10s. We bound the BATCH to ~50s below so
//   we always exit cleanly before Vercel kills us.
export const maxDuration = 60;

const BATCH_DEADLINE_MS = 50_000;
const MAX_CARDS_PER_RUN = 12;
const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
const STALE_LOCK_MS = 5 * 60 * 1000; // 5 min — a worker that's been "processing" longer than this is dead

/**
 * Cron worker: drain the image-generation queue.
 *
 * The queue is implicit: Card rows with imageUrl IS NULL are pending.
 * Workers claim a card via an atomic conditional update — only one
 * worker can win the claim, so the old race-on-cursor bug from the
 * fire-and-forget version cannot recur. After processing, success
 * fills imageUrl (and the row leaves the queue); failure bumps
 * imageGenAttempts + imageGenError so we can both surface the error
 * AND stop retrying after MAX_ATTEMPTS.
 *
 * Stale locks (> 5 min old) are treated as orphaned — recovers from
 * the case where a previous run died after claiming but before
 * finishing, e.g. Vercel killed the function unexpectedly.
 *
 * Triggered by Vercel cron every minute (vercel.json) and also called
 * inline once by the deck trigger route for instant first-batch
 * feedback. Both code paths share this implementation.
 */
export async function processQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  reason: "drained" | "deadline" | "no_work";
}> {
  const startedAt = Date.now();
  const deadline = startedAt + BATCH_DEADLINE_MS;
  const staleCutoff = new Date(startedAt - STALE_LOCK_MS);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Pull a slate of candidates. We over-pull (MAX_CARDS_PER_RUN) and
  // then attempt to atomically claim each one — losers (claimed by a
  // racing run) skip silently. Cheaper than a SELECT FOR UPDATE here
  // because Prisma doesn't expose row-level locks portably.
  const candidates = await prisma.card.findMany({
    where: {
      imageUrl: null,
      imageGenAttempts: { lt: MAX_ATTEMPTS },
      OR: [
        { imageGenLockedAt: null },
        { imageGenLockedAt: { lt: staleCutoff } },
      ],
    },
    select: {
      id: true,
      front: true,
      back: true,
      imageTier: true,
      deck: { select: { userId: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_CARDS_PER_RUN,
  });

  if (candidates.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, remaining: 0, reason: "no_work" };
  }

  // Worker-pool pattern. Each worker claims-then-processes one card at
  // a time, exits when there's no work or the deadline approaches.
  const queue = [...candidates];
  let deadlineHit = false;

  async function claim(cardId: string): Promise<boolean> {
    const claimedAt = new Date();
    const result = await prisma.card.updateMany({
      where: {
        id: cardId,
        imageUrl: null,
        imageGenAttempts: { lt: MAX_ATTEMPTS },
        OR: [
          { imageGenLockedAt: null },
          { imageGenLockedAt: { lt: staleCutoff } },
        ],
      },
      data: { imageGenLockedAt: claimedAt },
    });
    return result.count === 1;
  }

  async function processOne(card: (typeof candidates)[number]): Promise<void> {
    const won = await claim(card.id);
    if (!won) return; // another worker (or run) got it

    processed++;
    const tier: ImageTier = card.imageTier === "premium" ? "premium" : "quick";
    const userId = card.deck.userId;

    const consumed = await consumeImageCredit(userId, tier);
    if (!consumed.ok) {
      // No credits left for this user. Don't burn an attempt — the user
      // can top up and we'll try again. Just release the lock.
      await prisma.card.updateMany({
        where: { id: card.id },
        data: { imageGenLockedAt: null },
      });
      return;
    }

    try {
      const imageUrl = await generateAndUploadImage(
        userId,
        card.front,
        card.back,
        tier,
      );
      await prisma.card.updateMany({
        where: { id: card.id, imageUrl: null },
        data: {
          imageUrl,
          imageTier: tier,
          imageGenLockedAt: null,
          imageGenError: null,
        },
      });
      succeeded++;
    } catch (err) {
      await refundImageCredit(userId, consumed.source, consumed.amountUsed);
      const message = err instanceof Error ? err.message : String(err);
      await prisma.card.updateMany({
        where: { id: card.id },
        data: {
          imageGenAttempts: { increment: 1 },
          imageGenLockedAt: null,
          imageGenError: message.slice(0, 500),
        },
      });
      failed++;
      console.error(`[image-queue] card ${card.id}:`, message);
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, queue.length) },
    async () => {
      while (queue.length > 0) {
        if (Date.now() > deadline) {
          deadlineHit = true;
          return;
        }
        const card = queue.shift();
        if (!card) return;
        await processOne(card);
      }
    },
  );
  await Promise.all(workers);

  const remaining = await prisma.card.count({
    where: { imageUrl: null, imageGenAttempts: { lt: MAX_ATTEMPTS } },
  });

  return {
    processed,
    succeeded,
    failed,
    remaining,
    reason: deadlineHit ? "deadline" : "drained",
  };
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  // Vercel's built-in cron sends `Authorization: Bearer <secret>`;
  // external schedulers (and our own inline trigger) use x-cron-secret.
  // Accept either to keep the route portable.
  const headerSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processQueue();
  return NextResponse.json(result);
}
