import { prisma } from "@/lib/db";
import { getOptionalUser, ensureUser } from "@/lib/auth";
import { HomePage } from "./home-client";
import { LandingPage } from "./landing";
import { masteryLevel, letterGrade } from "@/lib/sm2";

export const dynamic = "force-dynamic";

async function computeDeckGrade(deckId: string): Promise<string> {
  const cards = await prisma.card.findMany({
    where: { deckId },
    select: { easeFactor: true, interval: true, repetitions: true },
  });
  if (cards.length === 0) return "New";
  const avg = Math.round(
    cards.reduce((sum, c) => sum + masteryLevel(c), 0) / cards.length
  );
  return letterGrade(avg);
}

export default async function Home() {
  const user = await getOptionalUser();

  if (!user) {
    return <LandingPage />;
  }

  const userId = await ensureUser();

  const [folders, unfolderedDecks] = await Promise.all([
    prisma.folder.findMany({
      where: { userId },
      include: {
        decks: {
          include: { _count: { select: { cards: true } } },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.deck.findMany({
      where: { folderId: null, userId },
      include: { _count: { select: { cards: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const foldersWithGrades = await Promise.all(
    folders.map(async (folder) => ({
      ...folder,
      decks: await Promise.all(
        folder.decks.map(async (deck) => ({
          ...deck,
          grade: await computeDeckGrade(deck.id),
        }))
      ),
    }))
  );

  const unfolderedWithGrades = await Promise.all(
    unfolderedDecks.map(async (deck) => ({
      ...deck,
      grade: await computeDeckGrade(deck.id),
    }))
  );

  const totalCards = await prisma.card.count({
    where: { deck: { userId } },
  });

  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const displayName = userData?.name || userData?.email?.split("@")[0] || "there";

  return (
    <HomePage
      folders={foldersWithGrades}
      unfolderedDecks={unfolderedWithGrades}
      totalCards={totalCards}
      userName={displayName}
    />
  );
}
