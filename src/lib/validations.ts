import { z } from "zod";

// ----- Decks -----
export const createDeckSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional().nullable(),
  emoji: z.string().max(10).optional().nullable(),
  folderId: z.string().cuid().optional().nullable(),
  frontVoice: z.string().max(200).optional().nullable(),
  backVoice: z.string().max(200).optional().nullable(),
  frontLanguageCode: z.string().max(16).optional().nullable(),
  backLanguageCode: z.string().max(16).optional().nullable(),
  // Optional inline cards array. When provided, deck + cards are
  // created atomically in one transaction — no orphan deck if the
  // card insert errors out.
  cards: z
    .array(
      z.object({
        front: z.string().min(1).max(5000),
        back: z.string().min(1).max(5000),
        hint: z.string().max(1000).optional().nullable(),
        imageUrl: z.string().url().max(2000).optional().nullable(),
        imageTier: z.enum(["quick", "premium"]).optional().nullable(),
      })
    )
    .max(500)
    .optional(),
});

export const updateDeckSchema = createDeckSchema.partial();

// ----- Cards -----
export const createCardSchema = z.object({
  front: z.string().min(1, "Front is required").max(5000),
  back: z.string().min(1, "Back is required").max(5000),
  hint: z.string().max(1000).optional().nullable(),
  tags: z.string().max(500).optional().nullable(),
  imageUrl: z.string().url().max(2000).optional().nullable(),
});

export const createCardsArraySchema = z.array(createCardSchema).min(1).max(500);

export const updateCardSchema = createCardSchema.partial();

// ----- Folders -----
export const createFolderSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  emoji: z.string().max(10).optional().nullable(),
});

export const updateFolderSchema = createFolderSchema.partial();

// ----- Review -----
export const reviewSubmitSchema = z.object({
  cardId: z.string().min(1),
  quality: z.number().int().min(0).max(5),
});

// ----- Generate -----
export const generateSchema = z.object({
  topic: z.string().min(1, "Topic is required").max(500),
  material: z.string().max(20000).optional(),
  // Human-readable language names (e.g. "Spanish (Spain)", "English
  // (UK)") for the front and back of the cards. When both are present
  // and differ, the generator translates — front in one language, back
  // in the other — instead of copying the same language onto both sides.
  frontLanguage: z.string().max(48).optional(),
  backLanguage: z.string().max(48).optional(),
});

// ----- AI Image -----
export const generateImageSchema = z.object({
  front: z.string().max(5000).optional(),
  back: z.string().max(5000).optional(),
  customPrompt: z.string().max(2000).optional(),
  // Optional pack context, recorded in the credit ledger so the user
  // can see which pack a spend was for on the /usage page.
  deckId: z.string().max(64).optional(),
  deckName: z.string().max(200).optional(),
}).refine(
  (data) => data.front || data.customPrompt,
  { message: "Card front text or custom prompt is required" }
);

export const generateBatchImagesSchema = z.object({
  cards: z.array(
    z.object({
      front: z.string().max(5000),
      back: z.string().max(5000),
      index: z.number().int().min(0),
    })
  ).min(1).max(30),
});

// ----- Rate Limiter -----
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiter.
 * Returns true if the request should be allowed.
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up old entries every 5 minutes
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  };
  setInterval(cleanup, 5 * 60 * 1000);
}
