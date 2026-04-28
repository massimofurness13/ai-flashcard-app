import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createDeckSchema } from "@/lib/validations";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const decks = await prisma.deck.findMany({
    where: { userId: auth.userId, archivedAt: null },
    include: {
      _count: { select: { cards: true } },
      folder: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();
  const decksWithDue = await Promise.all(
    decks.map(async (deck) => {
      const dueCount = await prisma.card.count({
        where: {
          deckId: deck.id,
          nextReviewAt: { lte: now },
        },
      });
      return { ...deck, dueCount };
    })
  );

  return NextResponse.json(decksWithDue);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createDeckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }
  const {
    name,
    description,
    emoji,
    folderId,
    frontVoice,
    backVoice,
    frontLanguageCode,
    backLanguageCode,
    cards,
  } = parsed.data;

  // If folderId provided, verify folder ownership
  if (folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId, userId: auth.userId },
      select: { id: true },
    });
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
  }

  // Atomic create: deck + (optional) cards in a single transaction.
  // If the card insert errors, the deck is rolled back too — no
  // orphan empty packs left in the library, which used to happen
  // when the cards POST failed after the deck was already saved.
  const deck = await prisma.$transaction(async (tx) => {
    const created = await tx.deck.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        emoji: emoji || undefined,
        folderId: folderId || null,
        frontVoice: frontVoice || null,
        backVoice: backVoice || null,
        frontLanguageCode: frontLanguageCode || null,
        backLanguageCode: backLanguageCode || null,
        userId: auth.userId,
      },
    });

    if (Array.isArray(cards) && cards.length > 0) {
      await tx.card.createMany({
        data: cards.map((c, i) => ({
          front: c.front.trim(),
          back: c.back.trim(),
          hint: c.hint?.trim() || null,
          imageUrl: c.imageUrl || null,
          imageTier: c.imageTier ?? null,
          position: i,
          deckId: created.id,
        })),
      });
    }

    return tx.deck.findUnique({
      where: { id: created.id },
      include: {
        _count: { select: { cards: true } },
        folder: true,
      },
    });
  });

  return NextResponse.json(deck, { status: 201 });
}
