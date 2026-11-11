-- Additive only. Do not invent which face historical reviews tested.
BEGIN;
ALTER TABLE "ReviewLog" ADD COLUMN IF NOT EXISTS "direction" TEXT
  CHECK ("direction" IN ('front', 'back'));
CREATE TABLE IF NOT EXISTS "CardRecall" (
  "cardId" TEXT NOT NULL REFERENCES "Card"("id") ON DELETE CASCADE,
  "direction" TEXT NOT NULL CHECK ("direction" IN ('front', 'back')),
  "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  "interval" INTEGER NOT NULL DEFAULT 0,
  "repetitions" INTEGER NOT NULL DEFAULT 0,
  "nextReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReviewedAt" TIMESTAMP(3) NOT NULL,
  "lastQuality" INTEGER NOT NULL,
  PRIMARY KEY ("cardId", "direction")
);
CREATE INDEX IF NOT EXISTS "CardRecall_nextReviewAt_idx" ON "CardRecall"("nextReviewAt");
ALTER TABLE "CardRecall" ENABLE ROW LEVEL SECURITY;
-- Server Prisma connection only; no anonymous/authenticated REST access.
REVOKE ALL ON "CardRecall" FROM anon, authenticated;
COMMIT;
