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
// Was 12; bumped to 40 after observing GitHub Actions cron throttle
// our */5 schedule down to ~25-30 min real cadence. At 12 cards per
// tick that's 24 cards/hour — a 100-card pack would take 4+ hours to
// drain. With 40 cards/tick (still well within the 50s deadline given
// CONCURRENCY=3 and ~3s per card) we drain ~80 cards/hour from cron
// alone, plus whatever in-tab polling does when the user's watching.
const MAX_CARDS_PER_RUN = 40;
// Concurrency 3 keeps fal.ai concurrency budget headroom (10 cap, app
// only ever uses 3 from cron + 3 from in-tab polling = 6 worst-case).
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
interface ProcessQueueOptions {
  /** When set, only consider cards owned by this user. */
  userId?: string;
  /** Override the default batch size. */
  maxCards?: number;
  /** Override the default time budget (milliseconds). */
  deadlineMs?: number;
}

export async function processQueue(opts: ProcessQueueOptions = {}): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  reason: "drained" | "deadline" | "no_work";
}> {
  const startedAt = Date.now();
  const deadline = startedAt + (opts.deadlineMs ?? BATCH_DEADLINE_MS);
  const maxCards = opts.maxCards ?? MAX_CARDS_PER_RUN;
  const staleCutoff = new Date(startedAt - STALE_LOCK_MS);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Pull a slate of candidates. We over-pull (maxCards) and then
  // attempt to atomically claim each one — losers (claimed by a
  // racing run) skip silently. Cheaper than a SELECT FOR UPDATE here
  // because Prisma doesn't expose row-level locks portably. With a
  // userId filter the query becomes per-user — used by the
  // /api/images/queue-tick endpoint that's driven by the user's
  // own polling loop, no Vercel cron required.
  const candidates = await prisma.card.findMany({
    where: {
      imageUrl: null,
      // Only cards the user explicitly requested an image for. Cards
      // born without imageTier (manual create, Anki import, abandoned
      // sessions) stay out of the queue — we never auto-burn credits
      // on cards the user didn't ask to illustrate.
      imageTier: { not: null },
      imageGenAttempts: { lt: MAX_ATTEMPTS },
      OR: [
        { imageGenLockedAt: null },
        { imageGenLockedAt: { lt: staleCutoff } },
      ],
      ...(opts.userId ? { deck: { userId: opts.userId } } : {}),
    },
    select: {
      id: true,
      front: true,
      back: true,
      imageTier: true,
      deck: { select: { userId: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: maxCards,
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
    where: {
      imageUrl: null,
      imageTier: { not: null },
      imageGenAttempts: { lt: MAX_ATTEMPTS },
      ...(opts.userId ? { deck: { userId: opts.userId } } : {}),
    },
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
