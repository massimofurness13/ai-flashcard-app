import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";
import { generateAndUploadImage } from "@/lib/stability-ai";

/**
 * Fire-and-forget image generation for all cards in a deck that
 * don't have an image yet. Returns immediately — generation continues
 * on the server regardless of whether the user stays on the page.
 *
 * The user can navigate, edit cards, delete cards, or close the tab
 * while this runs. The deck will auto-refresh if they come back.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const isPro = await isProUser(auth.userId);
  if (!isPro) {
    return NextResponse.json(
      { error: "Pro subscription required for AI image generation" },
      { status: 403 }
    );
  }

  const { deckId } = await request.json();
  if (!deckId || typeof deckId !== "string") {
    return NextResponse.json({ error: "deckId is required" }, { status: 400 });
  }

  // Verify ownership
  const deck = await prisma.deck.findUnique({
    where: { id: deckId, userId: auth.userId },
    select: { id: true },
  });
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  // Find cards needing images
  const cards = await prisma.card.findMany({
    where: { deckId, imageUrl: null },
    select: { id: true, front: true, back: true },
  });

  if (cards.length === 0) {
    return NextResponse.json({ queued: 0, message: "All cards already have images" });
  }

  // Kick off generation in the background — do NOT await.
  // The Node.js event loop on Render's long-running server will
  // keep processing these after the HTTP response is sent.
  // Each iteration re-checks the card still exists (in case user
  // deleted it) and that it still has no image (in case user uploaded).
  (async () => {
    for (const card of cards) {
      try {
        // Re-fetch to check current state — card may have been
        // deleted or had an image uploaded in the meantime
        const current = await prisma.card.findUnique({
          where: { id: card.id },
          select: { imageUrl: true, front: true, back: true },
        });
        if (!current) continue; // deleted
        if (current.imageUrl) continue; // user added one manually

        const imageUrl = await generateAndUploadImage(
          auth.userId,
          current.front,
          current.back
        );

        // Check one more time before writing — the user may have
        // edited the card's text in the meantime
        const stillNoImage = await prisma.card.findUnique({
          where: { id: card.id },
          select: { imageUrl: true },
        });
        if (stillNoImage && !stillNoImage.imageUrl) {
          await prisma.card.update({
            where: { id: card.id },
            data: { imageUrl },
          });
        }
      } catch (err) {
        // Log and keep going — one bad card shouldn't kill the batch
        console.error(`[background image] card ${card.id}:`, err);
      }
    }
  })().catch((err) => {
    console.error("[background image] batch failed:", err);
  });

  // Return immediately — client doesn't wait for generation
  return NextResponse.json({
    queued: cards.length,
    message: "Generation started. Images will appear as they're ready.",
  });
}
