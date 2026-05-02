-- Background image-generation queue state on Card.
-- Cards with imageUrl IS NULL are the queue. The cron worker at
-- /api/cron/process-image-queue claims them by atomically setting
-- imageGenLockedAt, generates the image, and either fills imageUrl
-- (success) or bumps imageGenAttempts + imageGenError (failure).
-- This replaces the fire-and-forget pattern that died on Vercel
-- function termination, leaving cards stranded forever.

ALTER TABLE "Card"
  ADD COLUMN IF NOT EXISTS "imageGenAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "imageGenLockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "imageGenError"    TEXT;

-- Partial index so the cron's "find candidates" query stays fast even
-- as the deck table grows. Only rows still in the queue are indexed.
CREATE INDEX IF NOT EXISTS "Card_imageGenQueue_idx"
  ON "Card" ("imageGenLockedAt", "imageGenAttempts")
  WHERE "imageUrl" IS NULL;
