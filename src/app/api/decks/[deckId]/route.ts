import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      (body.archive !== undefined && typeof body.archive !== "boolean")) {
    return NextResponse.json({ error: "Invalid pack update" }, { status: 400 });
  }

  // Verify ownership
  const existing = await prisma.deck.findUnique({
    where: { id: deckId, userId: auth.userId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  // If the user is moving the deck into a folder, verify they own
  // that folder. Without this, a user could move their deck under
  // another user's folderId — the deck would still be theirs (we
  // don't change userId) but it would surface inside the target
  // user's folder listing, leaking deck name/emoji/card-count.
  if (body.folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: body.folderId, userId: auth.userId },
      select: { id: true },
    });
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
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
      ...(body.frontLanguageCode !== undefined && {
        frontLanguageCode: body.frontLanguageCode || null,
      }),
      ...(body.backLanguageCode !== undefined && {
        backLanguageCode: body.backLanguageCode || null,
      }),
      ...(body.archive !== undefined && {
        archivedAt: body.archive ? new Date() : null,
      }),
    },
    include: {
      _count: { select: { cards: true } },
      folder: true,
    },
  });

  if (body.archive !== undefined) {
    revalidatePath("/");
    revalidatePath("/archive");
    revalidatePath("/study");
    revalidatePath(`/decks/${deckId}`);
  }
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
