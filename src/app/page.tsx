import { prisma } from "@/lib/db";
import { getOptionalUser, ensureUser } from "@/lib/auth";
import { HomePage } from "./home-client";
import { LandingPage } from "./landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getOptionalUser();

  // Unauthenticated → landing page
  if (!user) {
    return <LandingPage />;
  }

  // Authenticated → dashboard
  const userId = await ensureUser();

  const [folders, unfolderedDecks] = await Promise.all([
    prisma.folder.findMany({
      where: { userId },
      include: {
        decks: {
          include: {
            _count: { select: { cards: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.deck.findMany({
      where: { folderId: null, userId },
      include: {
        _count: { select: { cards: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const now = new Date();

  // Add due counts to all decks
  const foldersWithDue = await Promise.all(
    folders.map(async (folder) => ({
      ...folder,
      decks: await Promise.all(
        folder.decks.map(async (deck) => ({
          ...deck,
          dueCount: await prisma.card.count({
            where: { deckId: deck.id, nextReviewAt: { lte: now } },
          }),
        }))
      ),
    }))
  );

  const unfolderedWithDue = await Promise.all(
    unfolderedDecks.map(async (deck) => ({
      ...deck,
      dueCount: await prisma.card.count({
        where: { deckId: deck.id, nextReviewAt: { lte: now } },
      }),
    }))
  );

  const totalCards = await prisma.card.count({
    where: { deck: { userId } },
  });
  const totalDue = await prisma.card.count({
    where: { deck: { userId }, nextReviewAt: { lte: now } },
  });

  return (
    <HomePage
      folders={foldersWithDue}
      unfolderedDecks={unfolderedWithDue}
      totalCards={totalCards}
      totalDue={totalDue}
    />
  );
}
