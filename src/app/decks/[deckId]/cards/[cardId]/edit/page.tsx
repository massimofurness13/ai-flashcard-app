import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { notFound } from "next/navigation";
import { FlashcardForm } from "@/components/flashcard/flashcard-form";

export const dynamic = "force-dynamic";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ deckId: string; cardId: string }>;
}) {
  const userId = await ensureUser();
  const { deckId, cardId } = await params;

  const [card, isPro] = await Promise.all([
    prisma.card.findUnique({
      where: { id: cardId },
      include: { deck: { select: { userId: true } } },
    }),
    isProUser(userId),
  ]);

  if (!card || card.deck.userId !== userId) {
    notFound();
  }

  return (
    <div>
      <h1 className="font-editorial text-3xl font-medium sm:text-4xl mb-6">Edit Card</h1>
      <FlashcardForm
        deckId={deckId}
        mode="edit"
        isPro={isPro}
        initialData={{
          id: card.id,
          front: card.front,
          back: card.back,
          hint: card.hint,
          tags: card.tags,
          imageUrl: card.imageUrl,
          imageTier: card.imageTier,
        }}
      />
    </div>
  );
}
