-- FlashMind: image feedback + tier-aware regen
--
-- Run this in the Supabase SQL editor before the feedback feature deploys.
-- 1) Card gains imageTier (which AI tier produced the current image) and
--    freeImageRegenUsed (one free regen per card via feedback).
-- 2) New ImageFeedback table stores user-submitted reviews of generated
--    images so we can scan patterns and tune the prompt over time.

ALTER TABLE "Card"
  ADD COLUMN IF NOT EXISTS "imageTier" TEXT,
  ADD COLUMN IF NOT EXISTS "freeImageRegenUsed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ImageFeedback" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "cardId"    TEXT NOT NULL,
  "cardFront" TEXT NOT NULL,
  "cardBack"  TEXT NOT NULL,
  "imageUrl"  TEXT NOT NULL,
  "imageTier" TEXT NOT NULL,
  "feedback"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImageFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ImageFeedback_userId_idx"    ON "ImageFeedback" ("userId");
CREATE INDEX IF NOT EXISTS "ImageFeedback_cardId_idx"    ON "ImageFeedback" ("cardId");
CREATE INDEX IF NOT EXISTS "ImageFeedback_createdAt_idx" ON "ImageFeedback" ("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ImageFeedback_cardId_fkey'
  ) THEN
    ALTER TABLE "ImageFeedback"
      ADD CONSTRAINT "ImageFeedback_cardId_fkey"
      FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE;
  END IF;
END $$;
