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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Pack</h1>
      <DeckForm
        mode="edit"
        initialData={{
          id: deck.id,
          name: deck.name,
          description: deck.description,
          emoji: deck.emoji,
          folderId: deck.folderId,
        }}
      />
    </div>
  );
}
