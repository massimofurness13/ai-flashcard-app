import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL || "";
const adapter = new PrismaPg(connectionString);
const prisma = new PrismaClient({ adapter });

// Seed requires a userId. Pass SEED_USER_ID env var or it defaults to a test UUID.
const SEED_USER_ID = process.env.SEED_USER_ID || "00000000-0000-0000-0000-000000000001";

async function main() {
  // Clean existing data
  await prisma.reviewLog.deleteMany();
  await prisma.card.deleteMany();
  await prisma.deck.deleteMany();
  await prisma.folder.deleteMany();

  // Ensure the seed user exists
  await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    update: {},
    create: {
      id: SEED_USER_ID,
      email: "seed@huella.dev",
      name: "Seed User",
    },
  });

  // Create folders
  const languageFolder = await prisma.folder.create({
    data: { name: "Languages", emoji: "\ud83c\udf0d", color: "#3b82f6", userId: SEED_USER_ID },
  });

  const scienceFolder = await prisma.folder.create({
    data: { name: "Science", emoji: "\ud83d\udd2c", color: "#22c55e", userId: SEED_USER_ID },
  });

  // Create decks
  const spanishDeck = await prisma.deck.create({
    data: {
      name: "Spanish Basics",
      description: "Essential Spanish vocabulary and phrases",
      emoji: "\ud83c\uddea\ud83c\uddf8",
      folderId: languageFolder.id,
      userId: SEED_USER_ID,
    },
  });

  const biologyDeck = await prisma.deck.create({
    data: {
      name: "Biology 101",
      description: "Key biology concepts",
      emoji: "\ud83e\uddec",
      folderId: scienceFolder.id,
      userId: SEED_USER_ID,
    },
  });

  const capitalsDeck = await prisma.deck.create({
    data: {
      name: "World Capitals",
      description: "Test your knowledge of world capitals",
      emoji: "\ud83c\udfd9\ufe0f",
      userId: SEED_USER_ID,
    },
  });

  // Spanish cards
  const spanishCards = [
    { front: "Hello", back: "Hola", hint: "Most common greeting" },
    { front: "Goodbye", back: "Adi\u00f3s", hint: "Farewell" },
    { front: "Please", back: "Por favor", hint: "Polite request" },
    { front: "Thank you", back: "Gracias", hint: "Showing gratitude" },
    { front: "How are you?", back: "\u00bfC\u00f3mo est\u00e1s?", hint: "Asking about wellbeing" },
    { front: "Good morning", back: "Buenos d\u00edas", hint: "Morning greeting" },
    { front: "Good night", back: "Buenas noches", hint: "Evening farewell" },
    { front: "I don't understand", back: "No entiendo", hint: "Expressing confusion" },
    { front: "Where is...?", back: "\u00bfD\u00f3nde est\u00e1...?", hint: "Asking for location" },
    { front: "How much does it cost?", back: "\u00bfCu\u00e1nto cuesta?", hint: "Shopping phrase" },
  ];

  // Biology cards
  const biologyCards = [
    { front: "What is photosynthesis?", back: "The process by which plants convert light energy into chemical energy (glucose) using carbon dioxide and water", hint: "Light + CO2 + H2O" },
    { front: "What is the powerhouse of the cell?", back: "Mitochondria - produces ATP through cellular respiration", hint: "Starts with M" },
    { front: "What is DNA?", back: "Deoxyribonucleic acid - a molecule that carries genetic instructions for development and functioning of living organisms", hint: "Double helix structure" },
    { front: "What is osmosis?", back: "The movement of water molecules through a selectively permeable membrane from an area of lower solute concentration to higher", hint: "Water moves through membranes" },
    { front: "What are the four bases of DNA?", back: "Adenine (A), Thymine (T), Guanine (G), and Cytosine (C). A pairs with T, G pairs with C.", hint: "A-T, G-C" },
    { front: "What is mitosis?", back: "Cell division that results in two daughter cells with the same number of chromosomes as the parent cell", hint: "Equal division" },
    { front: "What is natural selection?", back: "The process where organisms with favorable traits are more likely to survive and reproduce, driving evolution", hint: "Darwin's theory" },
    { front: "What is an enzyme?", back: "A biological catalyst that speeds up chemical reactions in living organisms without being consumed", hint: "Biological catalyst" },
  ];

  // Capital cards
  const capitalCards = [
    { front: "What is the capital of France?", back: "Paris" },
    { front: "What is the capital of Japan?", back: "Tokyo" },
    { front: "What is the capital of Brazil?", back: "Bras\u00edlia" },
    { front: "What is the capital of Australia?", back: "Canberra" },
    { front: "What is the capital of Egypt?", back: "Cairo" },
    { front: "What is the capital of Canada?", back: "Ottawa" },
    { front: "What is the capital of Germany?", back: "Berlin" },
    { front: "What is the capital of India?", back: "New Delhi" },
    { front: "What is the capital of South Korea?", back: "Seoul" },
    { front: "What is the capital of Argentina?", back: "Buenos Aires" },
  ];

  // Insert cards
  for (let i = 0; i < spanishCards.length; i++) {
    const card = spanishCards[i];
    const now = new Date();
    // Make some cards "due" and some already reviewed
    const reviewed = i < 5;
    await prisma.card.create({
      data: {
        front: card.front,
        back: card.back,
        hint: card.hint || null,
        position: i,
        deckId: spanishDeck.id,
        easeFactor: reviewed ? 2.5 + (i * 0.1) : 2.5,
        interval: reviewed ? [1, 6, 15, 15, 30][i] : 0,
        repetitions: reviewed ? [1, 2, 3, 3, 4][i] : 0,
        nextReviewAt: reviewed
          ? new Date(now.getTime() + [0, 1, 3, -1, 7][i] * 86400000)
          : now,
      },
    });
  }

  for (let i = 0; i < biologyCards.length; i++) {
    await prisma.card.create({
      data: {
        front: biologyCards[i].front,
        back: biologyCards[i].back,
        hint: biologyCards[i].hint || null,
        position: i,
        deckId: biologyDeck.id,
      },
    });
  }

  for (let i = 0; i < capitalCards.length; i++) {
    await prisma.card.create({
      data: {
        front: capitalCards[i].front,
        back: capitalCards[i].back,
        position: i,
        deckId: capitalsDeck.id,
      },
    });
  }

  // Add some review history for the Spanish cards
  const spanishCardsDb = await prisma.card.findMany({
    where: { deckId: spanishDeck.id },
    take: 5,
  });

  const reviewDates = [];
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(10, 0, 0, 0);
    reviewDates.push(date);
  }

  for (const card of spanishCardsDb) {
    for (const date of reviewDates.slice(0, 3)) {
      await prisma.reviewLog.create({
        data: {
          cardId: card.id,
          quality: [3, 5, 5][Math.floor(Math.random() * 3)],
          easeFactor: card.easeFactor,
          interval: card.interval,
          reviewedAt: date,
        },
      });
    }
  }

  console.log("Seed complete!");
  console.log(`  User: ${SEED_USER_ID}`);
  console.log(`  Folders: 2`);
  console.log(`  Decks: 3 (Spanish Basics, Biology 101, World Capitals)`);
  console.log(`  Cards: ${spanishCards.length + biologyCards.length + capitalCards.length}`);
  console.log(`  Review logs: ${spanishCardsDb.length * 3}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
