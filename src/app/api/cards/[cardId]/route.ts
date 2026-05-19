import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { cardId } = await params;

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      deck: { select: { userId: true } },
      reviews: { orderBy: { reviewedAt: "desc" }, take: 10 },
    },
  });

  if (!card || card.deck.userId !== auth.userId) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  return NextResponse.json(card);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { cardId } = await params;
  const body = await request.json();

  // Verify ownership through deck
  const existing = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: { select: { userId: true } } },
  });

  if (!existing || existing.deck.userId !== auth.userId) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // Optimistic locking: if the client sends an `updatedAt` field, use
  // it as a precondition. Two tabs editing the same card will see the
  // second save returning 409 Conflict instead of silently wiping the
  // other tab's changes. Clients that don't send updatedAt keep the
  // legacy "last write wins" behaviour, so no UI breaks.
  const clientUpdatedAt =
    typeof body.updatedAt === "string" ? new Date(body.updatedAt) : null;

  if (clientUpdatedAt && !isNaN(clientUpdatedAt.getTime())) {
    const result = await prisma.card.updateMany({
      where: { id: cardId, updatedAt: clientUpdatedAt },
      data: {
        ...(body.front !== undefined && { front: body.front }),
        ...(body.back !== undefined && { back: body.back }),
        ...(body.hint !== undefined && { hint: body.hint || null }),
        ...(body.tags !== undefined && { tags: body.tags || null }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl || null }),
        ...(body.imageTier !== undefined && {
          imageTier:
            body.imageTier === "quick" || body.imageTier === "premium"
              ? body.imageTier
              : null,
        }),
        ...(body.position !== undefined && { position: body.position }),
      },
    });
    if (result.count === 0) {
      // Either the card was deleted, or someone else modified it
      // after the client loaded its data. Return the current state
      // so the client can reconcile.
      const current = await prisma.card.findUnique({ where: { id: cardId } });
      if (!current) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
      }
      return NextResponse.json(
        {
          error:
            "This card was edited elsewhere. Refresh to see the latest version.",
          current,
        },
        { status: 409 },
      );
    }
    const fresh = await prisma.card.findUnique({ where: { id: cardId } });
    return NextResponse.json(fresh);
  }

  const card = await prisma.card.update({
    where: { id: cardId },
    data: {
      ...(body.front !== undefined && { front: body.front }),
      ...(body.back !== undefined && { back: body.back }),
      ...(body.hint !== undefined && { hint: body.hint || null }),
      ...(body.tags !== undefined && { tags: body.tags || null }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl || null }),
      ...(body.imageTier !== undefined && {
        imageTier:
          body.imageTier === "quick" || body.imageTier === "premium"
            ? body.imageTier
            : null,
      }),
      ...(body.position !== undefined && { position: body.position }),
    },
  });

  return NextResponse.json(card);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { cardId } = await params;

  // Verify ownership through deck
  const existing = await prisma.card.findUnique({
    where: { id: cardId },
    include: { deck: { select: { userId: true } } },
  });

  if (!existing || existing.deck.userId !== auth.userId) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  await prisma.card.delete({ where: { id: cardId } });

  return NextResponse.json({ success: true });
}
