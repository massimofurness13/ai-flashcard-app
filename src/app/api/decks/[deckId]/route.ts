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

  const deck = await prisma.deck.findUnique({
    where: { id: deckId, userId: auth.userId },
    include: {
      cards: { orderBy: { position: "asc" } },
      folder: true,
      _count: { select: { cards: true } },
    },
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json(deck);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { deckId } = await params;
  const body = await request.json();

  // Verify ownership
  const existing = await prisma.deck.findUnique({
    where: { id: deckId, userId: auth.userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const deck = await prisma.deck.update({
    where: { id: deckId },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.emoji !== undefined && { emoji: body.emoji }),
      ...(body.folderId !== undefined && { folderId: body.folderId || null }),
      ...(body.frontVoice !== undefined && { frontVoice: body.frontVoice || null }),
      ...(body.backVoice !== undefined && { backVoice: body.backVoice || null }),
    },
    include: {
      _count: { select: { cards: true } },
      folder: true,
    },
  });

  return NextResponse.json(deck);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { deckId } = await params;

  // Verify ownership
  const existing = await prisma.deck.findUnique({
    where: { id: deckId, userId: auth.userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  await prisma.deck.delete({ where: { id: deckId } });

  return NextResponse.json({ success: true });
}
