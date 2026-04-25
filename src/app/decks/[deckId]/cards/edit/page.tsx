import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { EditCardsClient } from "./edit-cards-client";

export const dynamic = "force-dynamic";

/**
 * Bulk edit page for a pack's cards. Re-uses the same review-screen
 * UI from the create flow (per-card text/hint inputs + the silver/gold
 * tier slider for filling in missing images), so users get a single
 * mental model for "make changes to my cards" — no matter whether
 * they just generated the pack or are coming back to it later.
 */
export default async function EditCardsPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const userId = await ensureUser();
  const { deckId } = await params;

  const [deck, isPro] = await Promise.all([
    prisma.deck.findUnique({
      where: { id: deckId, userId },
      include: {
        cards: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            front: true,
            back: true,
            hint: true,
            imageUrl: true,
          },
        },
      },
    }),
    isProUser(userId),
  ]);

  if (!deck) notFound();

  return (
    <EditCardsClient
      deckId={deck.id}
      deckName={deck.name}
      deckEmoji={deck.emoji}
      initialCards={deck.cards}
      isPro={isPro}
    />
  );
}
