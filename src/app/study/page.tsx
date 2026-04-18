import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { StudyConfig } from "./study-config";

export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const userId = await ensureUser();

  const decks = await prisma.deck.findMany({
    where: { userId },
    include: { _count: { select: { cards: true } } },
    orderBy: { name: "asc" },
  });

  return <StudyConfig decks={decks} />;
}
