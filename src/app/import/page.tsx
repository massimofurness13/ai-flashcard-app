import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { ImportClient } from "./import-client";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const userId = await ensureUser();

  const [decks, isPro] = await Promise.all([
    prisma.deck.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, emoji: true },
    }),
    isProUser(userId),
  ]);

  return <ImportClient decks={decks} isPro={isPro} />;
}
