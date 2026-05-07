import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { processQueue } from "@/app/api/cron/process-image-queue/route";

// User-driven queue-drain tick. The deck-view polling loop hits this
// every 5s while a generation is active, replacing the dependency on
// Vercel cron (which on the hobby plan is capped at once-per-day and
// therefore can't drain a 50-card batch in real time).
//
// Each tick is bounded to ~10s and processes up to 4 cards owned by
// the requesting user, so it always completes well within the
// serverless function timeout. Concurrency is enforced inside
// processQueue via atomic claim — two tabs polling at the same time
// can't double-process the same card, they just split the work.
export const maxDuration = 30;

export async function POST() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const result = await processQueue({
    userId: auth.userId,
    maxCards: 4,
    deadlineMs: 10_000,
  });

  return NextResponse.json(result);
}
