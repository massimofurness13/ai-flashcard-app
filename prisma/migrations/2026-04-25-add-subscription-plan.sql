-- FlashMind: add billing cadence to Subscription
--
-- Run this in the Supabase SQL editor before the yearly-tier deploy lands.
-- Adds a `plan` column to Subscription with a safe default of "monthly" so
-- every existing Pro user keeps their current 500-credit allowance.
--
-- Plan values:
--   monthly  → 500 credits / month, resets at currentPeriodEnd
--   yearly   → 6,000 credits / year, ALL unlocked upfront on activation,
--              resets at currentPeriodEnd (one year from purchase)

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'monthly';
