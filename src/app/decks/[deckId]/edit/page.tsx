import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { DeckForm } from "@/components/deck/deck-form";

export const dynamic = "force-dynamic";

export default async function EditDeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const userId = await ensureUser();
  const { deckId } = await params;

  const deck = await prisma.deck.findUnique({
    where: { id: deckId, userId },
  });

  if (!deck) {
    notFound();
  }

  // First card doubles as a concrete front/back example next to the
  // language pickers — much clearer than asking the user to remember
  // which column they put which language in.
  const firstCard = await prisma.card.findFirst({
    where: { deckId },
    orderBy: { position: "asc" },
    select: { front: true, back: true },
  });

  return (
    <div>
      <h1 className="font-editorial text-3xl font-medium sm:text-4xl mb-6">Edit Pack</h1>
      <DeckForm
        mode="edit"
        initialData={{
          id: deck.id,
          name: deck.name,
          description: deck.description,
          emoji: deck.emoji,
          folderId: deck.folderId,
          frontVoice: deck.frontVoice,
          backVoice: deck.backVoice,
          frontLanguageCode: deck.frontLanguageCode,
          backLanguageCode: deck.backLanguageCode,
        }}
        previewCard={firstCard}
      />
    </div>
  );
}
