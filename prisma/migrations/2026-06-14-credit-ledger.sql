-- Huella: per-user credit ledger (audit log of every credit movement)
--
-- Until now the User row only stored running balances (imageCredits,
-- monthlyImagesUsed, lifetimeFreeImagesUsed) — there was no record of
-- WHERE credits went. Users (rightly) want to see "this pack cost 500
-- credits on June 13". This table is the append-only history that
-- powers the /usage page.
--
-- deckName/note are snapshotted at write time so deleting a pack later
-- doesn't erase the record of what it cost.
--
-- RLS: enabled with no policies, same posture as every other table —
-- Prisma (DB owner) bypasses it; Supabase's anon/authenticated REST
-- roles are denied. See 2026-05-20-enable-row-level-security.sql.

CREATE TABLE IF NOT EXISTS "CreditLedger" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "delta"     INTEGER NOT NULL,
  "kind"      TEXT NOT NULL,
  "source"    TEXT,
  "tier"      TEXT,
  "deckId"    TEXT,
  "deckName"  TEXT,
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreditLedger_userId_createdAt_idx"
  ON "CreditLedger" ("userId", "createdAt");

ALTER TABLE "CreditLedger"
  ADD CONSTRAINT "CreditLedger_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditLedger" ENABLE ROW LEVEL SECURITY;
