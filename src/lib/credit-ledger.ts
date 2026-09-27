import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Credit ledger — the append-only history behind the /usage page.
 *
 * The User row stores running BALANCES; this records every individual
 * MOVEMENT so a user can see exactly where their credits went. Financial
 * mutations should pass their transaction so balance and history are
 * atomic. Legacy callers without a transaction still use best-effort
 * logging until their workflows are migrated.
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

/** Transactional writes throw on failure; legacy standalone writes log failures. */
export async function recordLedger(
  entry: LedgerEntry,
  transaction?: Pick<Prisma.TransactionClient, "creditLedger">,
): Promise<void> {
  // Financial mutations pass their transaction. An audit failure must
  // then roll back the balance change rather than disappear silently.
  if (transaction) {
    await transaction.creditLedger.create({ data: entry });
    return;
  }
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
