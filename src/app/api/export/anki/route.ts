import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { prisma } from "@/lib/db";
import { buildApkg } from "@/lib/anki/export";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const isPro = await isProUser(auth.userId);
  if (!isPro) {
    return NextResponse.json(
      { error: "Pro subscription required for Anki export" },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const deckId = url.searchParams.get("deckId");

  if (!deckId) {
    return NextResponse.json(
      { error: "deckId is required" },
      { status: 400 }
    );
  }

  // Fetch deck with cards, verifying ownership
  const deck = await prisma.deck.findUnique({
    where: { id: deckId, userId: auth.userId },
    include: {
      cards: {
        select: {
          id: true,
          front: true,
          back: true,
          hint: true,
          tags: true,
          imageUrl: true,
          repetitions: true,
          easeFactor: true,
          interval: true,
          nextReviewAt: true,
        },
      },
    },
  });

  if (!deck) {
    return NextResponse.json(
      { error: "Deck not found" },
      { status: 404 }
    );
  }

  if (deck.cards.length === 0) {
    return NextResponse.json(
      { error: "Deck has no cards to export" },
      { status: 400 }
    );
  }

  try {
    const apkgBuffer = await buildApkg({
      id: deck.id,
      name: deck.name,
      description: deck.description,
      cards: deck.cards,
    });

    // Sanitize filename
    const safeName = deck.name.replace(/[^a-zA-Z0-9-_]/g, "_");

    return new NextResponse(new Uint8Array(apkgBuffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}.apkg"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
