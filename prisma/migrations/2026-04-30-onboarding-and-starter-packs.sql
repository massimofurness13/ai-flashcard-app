-- FlashMind: onboarding survey + starter packs
--
-- 1. User gains `learningLanguage`, `learningLevel`, and
--    `onboardingCompletedAt` so the welcome flow can ask "what are
--    you learning?" once per user and never again. The data also
--    becomes a tiny analytics layer: which language + level
--    combinations are our actual users on?
--
-- 2. New StarterPack + StarterCard tables hold pre-built decks for
--    each (language, level) combination. The first user who picks
--    a combo we don't have yet falls through to manual creation;
--    later we can add AI generation that fills these tables on
--    first request and serves cached copies thereafter.
--
-- 3. Seed three packs (Spanish A1, French A1, German A1) so the
--    most common new-user combinations have content immediately.
--    Each pack ships with 15 hand-curated cards covering greetings,
--    yes/no, and the most-frequent A1 nouns + verbs. No images
--    yet — the welcome screen renders them with emoji placeholders
--    until we run the image-gen pass that fills in real artwork.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "learningLanguage"      TEXT,
  ADD COLUMN IF NOT EXISTS "learningLevel"         TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "StarterPack" (
  "id"          TEXT NOT NULL,
  "language"    TEXT NOT NULL,
  "level"       TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "emoji"       TEXT DEFAULT '✨',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StarterPack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StarterPack_language_level_key"
  ON "StarterPack" ("language", "level");

CREATE TABLE IF NOT EXISTS "StarterCard" (
  "id"            TEXT NOT NULL,
  "starterPackId" TEXT NOT NULL,
  "front"         TEXT NOT NULL,
  "back"          TEXT NOT NULL,
  "hint"          TEXT,
  "imageUrl"      TEXT,
  "imageTier"    TEXT,
  "position"      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "StarterCard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StarterCard_starterPackId_idx"
  ON "StarterCard" ("starterPackId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StarterCard_starterPackId_fkey'
  ) THEN
    ALTER TABLE "StarterCard"
      ADD CONSTRAINT "StarterCard_starterPackId_fkey"
      FOREIGN KEY ("starterPackId") REFERENCES "StarterPack"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ── Seed data ────────────────────────────────────────────────────
-- Spanish A1
INSERT INTO "StarterPack" ("id", "language", "level", "name", "description", "emoji")
VALUES (
  'starter_es_a1',
  'es',
  'A1',
  'Spanish · A1 essentials',
  'Fifteen of the most useful Spanish words and phrases for absolute beginners.',
  '🇪🇸'
)
ON CONFLICT ("language", "level") DO NOTHING;

INSERT INTO "StarterCard" ("id", "starterPackId", "front", "back", "position") VALUES
  ('sc_es_a1_01', 'starter_es_a1', 'hola',         'hello',          0),
  ('sc_es_a1_02', 'starter_es_a1', 'gracias',      'thank you',      1),
  ('sc_es_a1_03', 'starter_es_a1', 'por favor',    'please',         2),
  ('sc_es_a1_04', 'starter_es_a1', 'sí',           'yes',            3),
  ('sc_es_a1_05', 'starter_es_a1', 'no',           'no',             4),
  ('sc_es_a1_06', 'starter_es_a1', 'la casa',      'the house',      5),
  ('sc_es_a1_07', 'starter_es_a1', 'el agua',      'the water',      6),
  ('sc_es_a1_08', 'starter_es_a1', 'el pan',       'the bread',      7),
  ('sc_es_a1_09', 'starter_es_a1', 'el café',      'the coffee',     8),
  ('sc_es_a1_10', 'starter_es_a1', 'la familia',   'the family',     9),
  ('sc_es_a1_11', 'starter_es_a1', 'el día',       'the day',       10),
  ('sc_es_a1_12', 'starter_es_a1', 'la noche',     'the night',     11),
  ('sc_es_a1_13', 'starter_es_a1', 'el amigo',     'the friend',    12),
  ('sc_es_a1_14', 'starter_es_a1', 'comer',        'to eat',        13),
  ('sc_es_a1_15', 'starter_es_a1', 'beber',        'to drink',      14)
ON CONFLICT ("id") DO NOTHING;

-- French A1
INSERT INTO "StarterPack" ("id", "language", "level", "name", "description", "emoji")
VALUES (
  'starter_fr_a1',
  'fr',
  'A1',
  'French · A1 essentials',
  'Fifteen of the most useful French words and phrases for absolute beginners.',
  '🇫🇷'
)
ON CONFLICT ("language", "level") DO NOTHING;

INSERT INTO "StarterCard" ("id", "starterPackId", "front", "back", "position") VALUES
  ('sc_fr_a1_01', 'starter_fr_a1', 'bonjour',          'hello',         0),
  ('sc_fr_a1_02', 'starter_fr_a1', 'merci',            'thank you',     1),
  ('sc_fr_a1_03', 'starter_fr_a1', 's''il vous plaît', 'please',        2),
  ('sc_fr_a1_04', 'starter_fr_a1', 'oui',              'yes',           3),
  ('sc_fr_a1_05', 'starter_fr_a1', 'non',              'no',            4),
  ('sc_fr_a1_06', 'starter_fr_a1', 'la maison',        'the house',     5),
  ('sc_fr_a1_07', 'starter_fr_a1', 'l''eau',           'the water',     6),
  ('sc_fr_a1_08', 'starter_fr_a1', 'le pain',          'the bread',     7),
  ('sc_fr_a1_09', 'starter_fr_a1', 'le café',          'the coffee',    8),
  ('sc_fr_a1_10', 'starter_fr_a1', 'la famille',       'the family',    9),
  ('sc_fr_a1_11', 'starter_fr_a1', 'le jour',          'the day',      10),
  ('sc_fr_a1_12', 'starter_fr_a1', 'la nuit',          'the night',    11),
  ('sc_fr_a1_13', 'starter_fr_a1', 'un ami',           'a friend',     12),
  ('sc_fr_a1_14', 'starter_fr_a1', 'manger',           'to eat',       13),
  ('sc_fr_a1_15', 'starter_fr_a1', 'boire',            'to drink',     14)
ON CONFLICT ("id") DO NOTHING;

-- German A1
INSERT INTO "StarterPack" ("id", "language", "level", "name", "description", "emoji")
VALUES (
  'starter_de_a1',
  'de',
  'A1',
  'German · A1 essentials',
  'Fifteen of the most useful German words and phrases for absolute beginners.',
  '🇩🇪'
)
ON CONFLICT ("language", "level") DO NOTHING;

INSERT INTO "StarterCard" ("id", "starterPackId", "front", "back", "position") VALUES
  ('sc_de_a1_01', 'starter_de_a1', 'hallo',        'hello',         0),
  ('sc_de_a1_02', 'starter_de_a1', 'danke',        'thank you',     1),
  ('sc_de_a1_03', 'starter_de_a1', 'bitte',        'please',        2),
  ('sc_de_a1_04', 'starter_de_a1', 'ja',           'yes',           3),
  ('sc_de_a1_05', 'starter_de_a1', 'nein',         'no',            4),
  ('sc_de_a1_06', 'starter_de_a1', 'das Haus',     'the house',     5),
  ('sc_de_a1_07', 'starter_de_a1', 'das Wasser',   'the water',     6),
  ('sc_de_a1_08', 'starter_de_a1', 'das Brot',     'the bread',     7),
  ('sc_de_a1_09', 'starter_de_a1', 'der Kaffee',   'the coffee',    8),
  ('sc_de_a1_10', 'starter_de_a1', 'die Familie',  'the family',    9),
  ('sc_de_a1_11', 'starter_de_a1', 'der Tag',      'the day',      10),
  ('sc_de_a1_12', 'starter_de_a1', 'die Nacht',    'the night',    11),
  ('sc_de_a1_13', 'starter_de_a1', 'der Freund',   'the friend',   12),
  ('sc_de_a1_14', 'starter_de_a1', 'essen',        'to eat',       13),
  ('sc_de_a1_15', 'starter_de_a1', 'trinken',      'to drink',     14)
ON CONFLICT ("id") DO NOTHING;
