-- Backfill onboardingCompletedAt for users who were already using
-- the app before the onboarding flow existed.
--
-- Symptom (production report): a user with 8 packs kept being
-- greeted with "Lovely to meet you, …" on every sign-in. Their
-- User row had `onboardingCompletedAt: NULL` (the field was added
-- after their account was created) and the home page's gate read
-- "no timestamp → show welcome", ignoring the fact that they
-- obviously already knew the app.
--
-- The code-level fix (require BOTH no-timestamp AND no-decks before
-- showing welcome) is in home-client.tsx in this same commit. This
-- migration also fixes the historical rows so we never have to rely
-- on that defensive guard for users who clearly aren't new — keeps
-- the data honest for analytics and lets future product changes
-- treat the timestamp as a real signal again.
--
-- Heuristic: if a user has at least one deck, they completed
-- onboarding at some point. We can't know exactly when, so we use
-- the date of their oldest deck — the most-conservative
-- approximation of "first time they used the app for real".
UPDATE "User"
SET    "onboardingCompletedAt" = sub."firstDeckAt"
FROM   (
  SELECT "userId", MIN("createdAt") AS "firstDeckAt"
  FROM   "Deck"
  GROUP  BY "userId"
) sub
WHERE  "User"."id" = sub."userId"
  AND  "User"."onboardingCompletedAt" IS NULL;
