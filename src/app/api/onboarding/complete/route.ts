import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * Finalises the onboarding flow:
 *   1. Saves the user's chosen learning language + level on User.
 *   2. If `cloneStarterPack` is true and we have a pre-built pack
 *      for that (language, level), clones it into the user's
 *      library as a fresh Deck + Cards atomically. The starter
 *      pack itself is untouched — it stays canonical so future
 *      users get the same content.
 *   3. Marks onboardingCompletedAt so we don't re-trigger the
 *      flow even if the user later deletes all their packs.
 *
 * Returns the deckId so the client can navigate straight into the
 * cloned pack — kicking off the first study session in seconds.
 */

const RequestSchema = z.object({
  language: z.string().min(2).max(8),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "unsure"]),
  cloneStarterPack: z.boolean().optional().default(true),
});

const LANGUAGE_TO_BCP47: Record<string, { front: string; back: string }> = {
  es: { front: "es-ES", back: "en-GB" },
  fr: { front: "fr-FR", back: "en-GB" },
  de: { front: "de-DE", back: "en-GB" },
  it: { front: "it-IT", back: "en-GB" },
  pt: { front: "pt-PT", back: "en-GB" },
  ja: { front: "ja-JP", back: "en-GB" },
  ko: { front: "ko-KR", back: "en-GB" },
  zh: { front: "cmn-CN", back: "en-GB" },
  en: { front: "en-GB", back: "en-GB" },
};

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }
  const { language, level, cloneStarterPack } = parsed.data;

  // Always save preferences even if there's no matching starter
  // pack — we still want the analytics + the user's own profile
  // to remember what they're studying.
  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      learningLanguage: language,
      learningLevel: level,
      onboardingCompletedAt: new Date(),
    },
  });

  if (!cloneStarterPack) {
    return NextResponse.json({ ok: true, deckId: null });
  }

  // Look up the starter pack for this combo. If we don't have one
  // yet (rare combo, or generation hasn't been built yet), the
  // client falls through to the manual-create flow.
  const starter = await prisma.starterPack.findUnique({
    where: { language_level: { language, level } },
    include: {
      cards: { orderBy: { position: "asc" } },
    },
  });

  if (!starter) {
    return NextResponse.json({
      ok: true,
      deckId: null,
      starterPackAvailable: false,
    });
  }

  const langCodes = LANGUAGE_TO_BCP47[language];

  // Atomic clone: deck + cards in a single transaction. If the
  // card insert fails the deck rolls back too — same pattern we
  // use for the manual generate flow.
  const deck = await prisma.$transaction(async (tx) => {
    const created = await tx.deck.create({
      data: {
        name: starter.name,
        description: starter.description,
        emoji: starter.emoji ?? "✨",
        userId: auth.userId,
        frontLanguageCode: langCodes?.front ?? null,
        backLanguageCode: langCodes?.back ?? null,
      },
    });

    if (starter.cards.length > 0) {
      await tx.card.createMany({
        data: starter.cards.map((c, i) => ({
          front: c.front,
          back: c.back,
          hint: c.hint,
          imageUrl: c.imageUrl,
          imageTier: c.imageTier,
          position: i,
          deckId: created.id,
        })),
      });
    }

    return created;
  });

  return NextResponse.json({
    ok: true,
    deckId: deck.id,
    deckName: deck.name,
    cardCount: starter.cards.length,
    starterPackAvailable: true,
  });
}
