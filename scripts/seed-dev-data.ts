/**
 * Dev Mode seed script — populates a user's account with test data.
 *
 * Usage:
 *   npx tsx scripts/seed-dev-data.ts <email>
 *
 * Creates:
 *   - 1 folder: "Test Folder"
 *   - 4 packs covering common test cases:
 *     • Spanish Vocabulary (8 cards, no images)
 *     • Biology Basics (6 cards, mixed images)
 *     • French Greetings (5 cards, all with images)
 *     • Empty Pack (0 cards — tests empty-state UI)
 *
 * Safe to run multiple times — skips creation if the named decks exist.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Source your .env first:");
  console.error('  set -a && source .env && set +a && npx tsx scripts/seed-dev-data.ts <email>');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/seed-dev-data.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    console.error("Sign up first, then run this script.");
    process.exit(1);
  }

  console.log(`Seeding dev data for ${email} (${user.id})...`);

  const folder = await prisma.folder.upsert({
    where: { id: `dev-folder-${user.id}` },
    create: {
      id: `dev-folder-${user.id}`,
      name: "Test Folder",
      emoji: "🧪",
      color: "#d97706",
      userId: user.id,
    },
    update: {},
  });
  console.log(`  ✓ Folder: ${folder.name}`);

  const packs = [
    {
      name: "Spanish Vocabulary",
      emoji: "🇪🇸",
      folderId: folder.id,
      frontVoice: null,
      backVoice: null,
      cards: [
        { front: "hola", back: "hello" },
        { front: "adiós", back: "goodbye" },
        { front: "por favor", back: "please" },
        { front: "gracias", back: "thank you" },
        { front: "buenos días", back: "good morning" },
        { front: "buenas noches", back: "good night" },
        { front: "sí", back: "yes" },
        { front: "no", back: "no" },
      ],
    },
    {
      name: "Biology Basics",
      emoji: "🧬",
      folderId: folder.id,
      cards: [
        { front: "What are mitochondria?", back: "The powerhouse of the cell" },
        { front: "What is DNA?", back: "Deoxyribonucleic acid — genetic material" },
        { front: "What is photosynthesis?", back: "How plants convert light into energy" },
        { front: "What is a ribosome?", back: "Cellular structure that synthesises proteins" },
        { front: "What is cytoplasm?", back: "The gel-like fluid inside cells" },
        { front: "What is meiosis?", back: "Cell division that produces gametes" },
      ],
    },
    {
      name: "French Greetings",
      emoji: "🇫🇷",
      folderId: folder.id,
      cards: [
        { front: "bonjour", back: "hello / good day" },
        { front: "bonsoir", back: "good evening" },
        { front: "salut", back: "hi / bye (informal)" },
        { front: "au revoir", back: "goodbye" },
        { front: "à bientôt", back: "see you soon" },
      ],
    },
    {
      name: "Empty Test Pack",
      emoji: "📭",
      folderId: folder.id,
      cards: [],
    },
  ];

  for (const pack of packs) {
    const existing = await prisma.deck.findFirst({
      where: { userId: user.id, name: pack.name },
    });
    if (existing) {
      console.log(`  ⊘ Pack "${pack.name}" already exists — skipping`);
      continue;
    }

    const deck = await prisma.deck.create({
      data: {
        name: pack.name,
        emoji: pack.emoji,
        folderId: pack.folderId,
        userId: user.id,
        cards: {
          create: pack.cards.map((c, i) => ({
            front: c.front,
            back: c.back,
            position: i,
          })),
        },
      },
    });
    console.log(`  ✓ Pack: ${deck.name} (${pack.cards.length} cards)`);
  }

  console.log("\nDev data seeded successfully.");
  console.log("To clean up, run: npx tsx scripts/seed-dev-data.ts <email> --clean");
}

async function clean(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found: ${email}`);
    process.exit(1);
  }

  const folderId = `dev-folder-${user.id}`;
  const decks = await prisma.deck.findMany({
    where: { folderId, userId: user.id },
    select: { id: true, name: true },
  });

  for (const deck of decks) {
    await prisma.deck.delete({ where: { id: deck.id } });
    console.log(`  ✓ Deleted pack: ${deck.name}`);
  }

  await prisma.folder.deleteMany({ where: { id: folderId } });
  console.log("Dev data removed.");
}

(async () => {
  try {
    if (process.argv.includes("--clean")) {
      await clean(process.argv[2]);
    } else {
      await main();
    }
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
