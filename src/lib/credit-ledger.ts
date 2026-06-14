import { prisma } from "@/lib/db";

/**
 * Credit ledger — the append-only history behind the /usage page.
 *
 * The User row stores running BALANCES; this records every individual
 * MOVEMENT so a user can see exactly where their credits went. Writes
 * are best-effort and must NEVER throw into the caller: a failed audit
 * insert must not break image generation or a Stripe webhook. So every
 * write is wrapped and swallowed here.
 */

export type LedgerKind = "spend" | "refund" | "purchase" | "grant";

export interface LedgerEntry {
  userId: string;
  /** Signed: negative = spent, positive = added. */
  delta: number;
  kind: LedgerKind;
  /** Balance bucket that moved: "monthly" | "credits" | "free". */
  source?: string | null;
  /** Image tier for image spends/refunds: "premium" | "quick". */
  tier?: string | null;
  deckId?: string | null;
  deckName?: string | null;
  note?: string | null;
}

/** Best-effort ledger write. Never throws — logs and moves on. */
export async function recordLedger(entry: LedgerEntry): Promise<void> {
  try {
    await prisma.creditLedger.create({
      data: {
        userId: entry.userId,
        delta: entry.delta,
        kind: entry.kind,
        source: entry.source ?? null,
        tier: entry.tier ?? null,
        deckId: entry.deckId ?? null,
        deckName: entry.deckName ?? null,
        note: entry.note ?? null,
      },
    });
  } catch (err) {
    // The ledger is an audit nicety — never let it break the caller.
    console.error("[credit-ledger] failed to record entry:", err);
  }
}
