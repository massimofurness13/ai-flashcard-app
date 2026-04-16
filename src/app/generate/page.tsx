import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { GenerateClient } from "./generate-client";

export const dynamic = "force-dynamic";

export default async function GeneratePage() {
  const userId = await ensureUser();

  const [decks, isPro] = await Promise.all([
    prisma.deck.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, emoji: true },
    }),
    isProUser(userId),
  ]);

  return (
    <Suspense>
      <GenerateClient decks={decks} isPro={isPro} />
    </Suspense>
  );
}
