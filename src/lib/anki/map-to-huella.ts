import type { AnkiCard, AnkiNote, AnkiModelMeta, ParsedApkg } from "./types";

/**
 * A card mapped from Anki format to Huella format, ready for DB insertion.
 */
export interface MappedCard {
  front: string;
  back: string;
  hint: string | null;
  tags: string | null;
  /** Anki deck name this card belongs to */
  deckName: string;
  /** SM-2 state mapped from Anki's scheduling data */
  sm2: {
    repetitions: number;
    easeFactor: number;
    interval: number;
    nextReview: Date | null;
  };
  /** Media filenames referenced by this card */
  mediaRefs: string[];
}

const FIELD_SEPARATOR = "\x1f"; // Anki's field separator

/**
 * Strip HTML tags from Anki field content.
 * Anki stores fields as HTML, we want plain text for Huella.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<div>/gi, "\n")
    .replace(/<\/div>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Extract media references (filenames) from Anki HTML content.
 * Anki uses [sound:filename.mp3] and <img src="filename.jpg"> patterns.
 */
function extractMediaRefs(html: string): string[] {
  const refs: string[] = [];

  // [sound:filename.mp3]
  const soundMatches = html.matchAll(/\[sound:([^\]]+)\]/g);
  for (const m of soundMatches) {
    refs.push(m[1]);
  }

  // <img src="filename.jpg">
  const imgMatches = html.matchAll(/<img[^>]+src="([^"]+)"/gi);
  for (const m of imgMatches) {
    // Skip external URLs
    if (!m[1].startsWith("http://") && !m[1].startsWith("https://")) {
      refs.push(m[1]);
    }
  }

  return refs;
}

/**
 * Map Anki SM-2 scheduling data to Huella SM-2 format.
 *
 * Anki stores:
 *  - factor: ease factor in permille (2500 = 2.5)
 *  - ivl: interval in days
 *  - reps: number of reviews
 *  - type: 0=new, 1=learning, 2=review, 3=relearn
 *
 * Huella SM-2:
 *  - easeFactor: float (2.5)
 *  - interval: days
 *  - repetitions: count
 *  - nextReview: Date
 */
function mapSm2State(card: AnkiCard): MappedCard["sm2"] {
  const easeFactor = card.factor > 0 ? card.factor / 1000 : 2.5;
  const interval = Math.max(card.ivl, 0);
  const repetitions = card.reps;

  // Calculate next review date
  // For new/learning cards, set to now (needs review)
  // For review cards, set to now + interval days
  let nextReview: Date | null = null;
  if (card.type === 2 && interval > 0) {
    // Review card — schedule based on interval
    const now = new Date();
    nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  } else {
    // New, learning, or relearning — due now
    nextReview = new Date();
  }

  return { repetitions, easeFactor, interval, nextReview };
}

/**
 * Build the deck name -> ID map from parsed Anki data.
 */
function buildDeckMap(parsed: ParsedApkg): Map<number, string> {
  const deckMap = new Map<number, string>();
  for (const deck of parsed.decks) {
    // Skip the "Default" deck if it has no cards
    deckMap.set(deck.id, deck.name);
  }
  return deckMap;
}

/**
 * Map all parsed Anki data to Huella card format.
 *
 * Handles:
 *  - Multi-field notes (first field = front, rest = back)
 *  - HTML stripping
 *  - SM-2 state conversion
 *  - Media reference extraction
 *  - Multi-deck assignment
 */
export function mapToHuella(parsed: ParsedApkg): MappedCard[] {
  const deckMap = buildDeckMap(parsed);
  const noteMap = new Map<number, AnkiNote>();

  for (const note of parsed.notes) {
    noteMap.set(note.id, note);
  }

  const mappedCards: MappedCard[] = [];

  for (const card of parsed.cards) {
    const note = noteMap.get(card.nid);
    if (!note) continue;

    const model = parsed.models.get(note.mid);
    const fields = note.flds.split(FIELD_SEPARATOR);

    // Map fields to front/back
    // Standard: first field = front, second = back
    // If more fields exist, join them into back with labels
    let front = stripHtml(fields[0] || "");
    let back = "";
    let hint: string | null = null;

    if (fields.length === 1) {
      back = front;
    } else if (fields.length === 2) {
      back = stripHtml(fields[1]);
    } else {
      // Multiple fields — use model field names if available
      const fieldNames = model?.fields || [];
      const backParts: string[] = [];

      for (let i = 1; i < fields.length; i++) {
        const content = stripHtml(fields[i]);
        if (!content) continue;

        const fieldName = fieldNames[i];
        // If there's a field named "Hint" or similar, use it
        if (fieldName && /hint/i.test(fieldName)) {
          hint = content;
        } else if (fieldName && i > 1) {
          backParts.push(`${fieldName}: ${content}`);
        } else {
          backParts.push(content);
        }
      }
      back = backParts.join("\n");
    }

    // Skip empty cards
    if (!front && !back) continue;
    if (!front) front = "(empty front)";
    if (!back) back = "(empty back)";

    // Extract media refs from raw HTML fields
    const mediaRefs: string[] = [];
    for (const field of fields) {
      mediaRefs.push(...extractMediaRefs(field));
    }

    // Get deck name
    const deckName = deckMap.get(card.did) || "Imported";

    // Parse tags
    const tags = note.tags.trim() || null;

    mappedCards.push({
      front,
      back,
      hint,
      tags,
      deckName,
      sm2: mapSm2State(card),
      mediaRefs,
    });
  }

  return mappedCards;
}
