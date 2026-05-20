-- Enable Row Level Security on every public table.
--
-- Why: Supabase exposes a PostgREST API at /rest/v1/<Table> on every
-- table in the public schema. With RLS disabled, the anon role
-- (whose key ships in the browser as NEXT_PUBLIC_SUPABASE_ANON_KEY)
-- gets full read / write / delete on every row. Anyone with our
-- project URL could pull the entire User / Card / Subscription /
-- CreditPurchase tables. Supabase's Security Advisor flagged this.
--
-- Why no CREATE POLICY statements: the app talks to Postgres via
-- Prisma using DATABASE_URL, which connects as the database owner.
-- That role bypasses RLS. RLS-enabled-with-no-policies denies all
-- access to anon + authenticated roles (Supabase's REST API) while
-- leaving Prisma untouched. Exactly the model we want — Prisma is
-- the only legitimate way into these tables.
--
-- If we ever start using the supabase-js client to query tables
-- directly from the browser, add CREATE POLICY statements scoped
-- to (auth.uid() = userId) — until then, the closed-by-default
-- posture is correct.

ALTER TABLE "User"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditPurchase"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Folder"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deck"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Card"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImageFeedback"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewLog"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StarterPack"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StarterCard"      ENABLE ROW LEVEL SECURITY;
