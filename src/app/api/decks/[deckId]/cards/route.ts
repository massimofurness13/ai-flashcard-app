import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { deckId } = await params;

  // Verify deck ownership
  const deck = await prisma.deck.findUnique({
    where: { id: deckId, userId: auth.userId },
    select: { id: true },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const cards = await prisma.card.findMany({
    where: { deckId },
    orderBy: { position: "asc" },
  });

  return NextResponse.json(cards);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { deckId } = await params;
  const body = await request.json();

  // Verify deck ownership
  const deck = await prisma.deck.findUnique({
    where: { id: deckId, userId: auth.userId },
    select: { id: true },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  // Support bulk creation (array of cards) or single card
  const cardsData = Array.isArray(body) ? body : [body];

  const maxPosition = await prisma.card.aggregate({
    where: { deckId },
    _max: { position: true },
  });

  let nextPosition = (maxPosition._max.position ?? -1) + 1;

  const created = await Promise.all(
    cardsData.map(async (cardData) => {
      const card = await prisma.card.create({
        data: {
          front: cardData.front,
          back: cardData.back,
          hint: cardData.hint || null,
          tags: cardData.tags || null,
          imageUrl: cardData.imageUrl || null,
          imageTier:
            cardData.imageTier === "quick" || cardData.imageTier === "premium"
              ? cardData.imageTier
              : null,
          position: nextPosition++,
          deckId,
        },
      });
      return card;
    })
  );

  return NextResponse.json(created.length === 1 ? created[0] : created, {
    status: 201,
  });
}
