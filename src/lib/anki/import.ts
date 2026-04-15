import { prisma } from "@/lib/db";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { parseApkg } from "./parse-apkg";
import { mapToFlashMind, type MappedCard } from "./map-to-flashmind";

const BUCKET = "card-images";

interface ImportResult {
  decksCreated: number;
  cardsImported: number;
  mediaUploaded: number;
  deckIds: string[];
  errors: string[];
}

/**
 * Upload media files from Anki package to Supabase Storage.
 * Returns a map of original filename -> public URL.
 */
async function uploadMedia(
  userId: string,
  mediaFiles: Map<string, Buffer>
): Promise<{ urlMap: Map<string, string>; uploaded: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return { urlMap: new Map(), uploaded: 0 };
  }

  const supabase = createServiceClient(supabaseUrl, serviceKey);
  const urlMap = new Map<string, string>();
  let uploaded = 0;

  for (const [filename, bytes] of mediaFiles) {
    // Only upload images (skip audio for now)
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
    if (!imageExts.includes(ext)) continue;

    // Skip files larger than 5MB
    if (bytes.length > 5 * 1024 * 1024) continue;

    const contentTypeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      bmp: "image/bmp",
    };

    const storagePath = `${userId}/anki-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${filename}`;

    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: contentTypeMap[ext] || "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

    if (!error) {
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);
      urlMap.set(filename, urlData.publicUrl);
      uploaded++;
    }
  }

  return { urlMap, uploaded };
}

/**
 * Find the first image reference in a card's media refs and return its URL.
 */
function findCardImage(
  card: MappedCard,
  mediaUrlMap: Map<string, string>
): string | null {
  for (const ref of card.mediaRefs) {
    const url = mediaUrlMap.get(ref);
    if (url) return url;
  }
  return null;
}

/**
 * Full Anki .apkg import pipeline:
 *  1. Parse .apkg ZIP (SQLite + media)
 *  2. Map Anki fields to FlashMind format
 *  3. Upload media to Supabase Storage
 *  4. Create decks + cards in database with SM-2 state
 */
export async function importAnkiPackage(
  userId: string,
  fileBuffer: Buffer
): Promise<ImportResult> {
  const errors: string[] = [];

  // Step 1: Parse the .apkg file
  const parsed = await parseApkg(fileBuffer);

  // Step 2: Map to FlashMind format
  const mappedCards = mapToFlashMind(parsed);

  if (mappedCards.length === 0) {
    return {
      decksCreated: 0,
      cardsImported: 0,
      mediaUploaded: 0,
      deckIds: [],
      errors: ["No cards found in the .apkg file"],
    };
  }

  // Step 3: Upload media
  const { urlMap: mediaUrlMap, uploaded: mediaUploaded } = await uploadMedia(
    userId,
    parsed.mediaFiles
  );

  // Step 4: Group cards by deck
  const cardsByDeck = new Map<string, MappedCard[]>();
  for (const card of mappedCards) {
    const existing = cardsByDeck.get(card.deckName) || [];
    existing.push(card);
    cardsByDeck.set(card.deckName, existing);
  }

  // Step 5: Create decks and cards
  const deckIds: string[] = [];
  let totalCardsImported = 0;

  for (const [deckName, cards] of cardsByDeck) {
    try {
      // Clean up Anki deck hierarchy names (e.g., "Parent::Child" -> "Child")
      const displayName = deckName.includes("::")
        ? deckName.split("::").pop() || deckName
        : deckName;

      // Skip "Default" deck if it has no real cards
      if (deckName === "Default" && cards.every((c) => c.front === "(empty front)")) {
        continue;
      }

      // Create the deck
      const deck = await prisma.deck.create({
        data: {
          name: displayName,
          description: `Imported from Anki: ${deckName}`,
          userId,
        },
      });

      deckIds.push(deck.id);

      // Create cards in batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < cards.length; i += BATCH_SIZE) {
        const batch = cards.slice(i, i + BATCH_SIZE);

        await prisma.card.createMany({
          data: batch.map((c) => ({
            deckId: deck.id,
            front: c.front,
            back: c.back,
            hint: c.hint,
            tags: c.tags,
            imageUrl: findCardImage(c, mediaUrlMap),
            // SM-2 state from Anki
            repetitions: c.sm2.repetitions,
            easeFactor: c.sm2.easeFactor,
            interval: c.sm2.interval,
            nextReviewAt: c.sm2.nextReview || new Date(),
          })),
        });

        totalCardsImported += batch.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Failed to import deck "${deckName}": ${msg}`);
    }
  }

  return {
    decksCreated: deckIds.length,
    cardsImported: totalCardsImported,
    mediaUploaded,
    deckIds,
    errors,
  };
}
