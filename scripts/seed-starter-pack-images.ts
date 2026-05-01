/**
 * Generate and persist canonical illustrations for every StarterCard
 * that doesn't already have one.
 *
 * Why this exists: starter packs ship as text-only cards. We want
 * brand-new users to see real illustrations on their very first study
 * session — but if every new user generated their own images on
 * clone, we'd burn their lifetime AI credits before they did anything.
 * Generating once, persisting on the canonical StarterCard rows, and
 * letting every clone reuse the same images is dramatically cheaper
 * (and lets us hand-pick "half Quick / half Premium" so users
 * immediately feel the tier difference).
 *
 * Tier strategy: alternate by position. Even-indexed cards (0, 2,
 * 4, ...) get Premium; odd-indexed (1, 3, 5, ...) get Quick. The
 * user studies one of each in their first few cards and sees the
 * gap between the two tiers without having to click anything.
 *
 * Idempotent: rows that already have imageUrl are skipped, so this
 * script is safe to re-run after adding new starter packs.
 *
 * Run: `npx tsx scripts/seed-starter-pack-images.ts`
 *
 * Cost estimate: ~$0.025/Premium + ~$0.003/Quick on FLUX = roughly
 * $0.20-$0.30 per 15-card pack. For the three seeded packs combined,
 * call it $0.50-$1 total in FAL credits + a few cents in Anthropic
 * API for the concept-builder + validator passes.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateAndUploadImage, type ImageTier } from "../src/lib/image-gen.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}
const adapter = new PrismaPg(connectionString);
const prisma = new PrismaClient({ adapter });

// userId-equivalent used in the storage path. Supabase doesn't care
// whether this maps to a real auth user — it's just a folder. Keeping
// starter-pack images in their own namespace makes them easy to spot
// in the dashboard and easy to bulk-clear if we ever regenerate.
const STARTER_OWNER = "starter-packs";

// Pause between generations so we don't hammer the APIs. Generous —
// the script runs once per pack ever, so 1.5s extra per card costs us
// nothing in practice.
const DELAY_MS = 1_500;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const cards = await prisma.starterCard.findMany({
    where: { imageUrl: null },
    orderBy: [{ starterPackId: "asc" }, { position: "asc" }],
    include: {
      starterPack: { select: { name: true } },
    },
  });

  if (cards.length === 0) {
    console.log("Every starter card already has an image — nothing to do.");
    return;
  }

  console.log(
    `Generating images for ${cards.length} starter cards across all packs...`
  );
  console.log(
    "Tier strategy: even positions → Premium, odd positions → Quick.\n"
  );

  let succeeded = 0;
  let failed = 0;

  for (const card of cards) {
    const tier: ImageTier = card.position % 2 === 0 ? "premium" : "quick";
    const label = `[${card.starterPack.name}] ${card.front} → ${card.back}`;

    process.stdout.write(`  ${label.padEnd(60)} (${tier})... `);

    try {
      const imageUrl = await generateAndUploadImage(
        STARTER_OWNER,
        card.front,
        card.back,
        tier
      );
      await prisma.starterCard.update({
        where: { id: card.id },
        data: { imageUrl, imageTier: tier },
      });
      console.log("✓");
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`✗  ${message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`);
  if (failed > 0) {
    console.log(
      "Re-run the script to retry the failed ones — successful rows are skipped."
    );
  }
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
