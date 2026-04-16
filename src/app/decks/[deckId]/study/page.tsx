import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StudyClient } from "./study-client";

export const dynamic = "force-dynamic";

export default async function StudyPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const userId = await ensureUser();
  const { deckId } = await params;

  const deck = await prisma.deck.findUnique({
    where: { id: deckId, userId },
    include: {
      cards: { orderBy: { position: "asc" } },
    },
  });

  if (!deck || deck.cards.length === 0) {
    notFound();
  }

  return (
    <StudyClient
      deckId={deck.id}
      deckName={deck.name}
      frontVoice={deck.frontVoice}
      backVoice={deck.backVoice}
      cards={deck.cards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        imageUrl: c.imageUrl,
        hint: c.hint,
      }))}
    />
  );
}
