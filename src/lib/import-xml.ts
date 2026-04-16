import { XMLParser } from "fast-xml-parser";
import type { ParsedCard } from "./import-csv";

const FRONT_NAMES = ["front", "question", "term", "word", "prompt", "text"];
const BACK_NAMES = ["back", "answer", "definition", "meaning", "response", "translation"];
const HINT_NAMES = ["hint", "clue", "mnemonic", "note"];
const TAGS_NAMES = ["tags", "tag", "category", "label"];

function matchesList(value: string, list: string[]): boolean {
  return list.includes(value.toLowerCase());
}

// ---- Strategy 1: Standard tag-name based cards ----
// e.g. <card><front>...</front><back>...</back></card>
function tryTagNameCards(parsed: unknown): ParsedCard[] {
  const cards = findCardArrays(parsed);
  const results: ParsedCard[] = [];

  for (const card of cards) {
    if (!card || typeof card !== "object" || Array.isArray(card)) continue;
    const rec = card as Record<string, unknown>;
    const front = matchByTagName(rec, FRONT_NAMES);
    const back = matchByTagName(rec, BACK_NAMES);
    if (!front || !back) continue;

    const entry: ParsedCard = { front: front.trim(), back: back.trim() };
    if (!entry.front || !entry.back) continue;

    const hint = matchByTagName(rec, HINT_NAMES)?.trim();
    const tags = matchByTagName(rec, TAGS_NAMES)?.trim();
    if (hint) entry.hint = hint;
    if (tags) entry.tags = tags;
    results.push(entry);
  }

  return results;
}

function matchByTagName(obj: Record<string, unknown>, names: string[]): string | undefined {
  for (const key of Object.keys(obj)) {
    if (matchesList(key, names)) {
      const val = obj[key];
      if (typeof val === "string") return val;
      if (typeof val === "number") return String(val);
    }
  }
  return undefined;
}

// ---- Strategy 2: Attribute-based cards (e.g. TTS flashcard apps) ----
// e.g. <card><tts name="Text">...</tts><tts name="Translation">...</tts></card>
function tryAttributeCards(content: string): ParsedCard[] {
  const attrParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });

  let parsed: unknown;
  try {
    parsed = attrParser.parse(content);
  } catch {
    return [];
  }

  const cards = findCardArrays(parsed);
  const results: ParsedCard[] = [];

  for (const card of cards) {
    if (!card || typeof card !== "object" || Array.isArray(card)) continue;
    const rec = card as Record<string, unknown>;

    // Look for arrays of elements with @_name attributes
    // e.g. { tts: [ { "@_name": "Text", "#text": "..." }, { "@_name": "Translation", "#text": "..." } ] }
    let front: string | undefined;
    let back: string | undefined;
    let hint: string | undefined;

    for (const value of Object.values(rec)) {
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const el = item as Record<string, unknown>;
        const name = (el["@_name"] as string) || "";
        const text = extractText(el);
        if (!text) continue;

        if (matchesList(name, FRONT_NAMES)) front = text;
        else if (matchesList(name, BACK_NAMES)) back = text;
        else if (matchesList(name, HINT_NAMES)) hint = text;
        // If we haven't matched front yet, first element is front
        else if (!front) front = text;
        // If front is set but back isn't, next element is back
        else if (!back) back = text;
      }
    }

    if (front && back) {
      const entry: ParsedCard = { front: front.trim(), back: back.trim() };
      if (!entry.front || !entry.back) continue;
      if (hint) entry.hint = hint.trim();
      results.push(entry);
    }
  }

  return results;
}

function extractText(el: Record<string, unknown>): string | undefined {
  // fast-xml-parser puts text content in #text when attributes are present
  if (typeof el["#text"] === "string") return el["#text"];
  if (typeof el["#text"] === "number") return String(el["#text"]);
  // Or it might be a direct string value
  for (const val of Object.values(el)) {
    if (typeof val === "string" && !val.startsWith("@")) return val;
  }
  return undefined;
}

// ---- Shared: find arrays of card-like objects in parsed tree ----
function findCardArrays(parsed: unknown): unknown[] {
  if (!parsed || typeof parsed !== "object") return [];

  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && parsed[0] && typeof parsed[0] === "object") return parsed;
    for (const item of parsed) {
      const found = findCardArrays(item);
      if (found.length > 0) return found;
    }
    return [];
  }

  const obj = parsed as Record<string, unknown>;
  // Look for keys named "card", "cards", "item", "entry" etc.
  const cardKeyNames = ["card", "cards", "item", "entry", "row"];

  for (const [key, value] of Object.entries(obj)) {
    if (cardKeyNames.includes(key.toLowerCase())) {
      if (Array.isArray(value)) return value;
      // If it's a single object, it might be a wrapper (e.g. "cards" containing "card")
      // or a single card. Recurse into it first.
      if (value && typeof value === "object") {
        const deeper = findCardArrays(value);
        if (deeper.length > 0) return deeper;
        // If nothing found deeper, treat this object as a single card
        return [value];
      }
    }
  }

  // Recurse into all object values
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findCardArrays(value);
      if (found.length > 0) return found;
    }
  }

  return [];
}

// ---- Main entry point ----
export function parseXML(content: string): ParsedCard[] {
  // Strategy 1: Parse with attributes ignored, match by tag names
  const simpleParser = new XMLParser({ ignoreAttributes: true, trimValues: true });
  try {
    const parsed = simpleParser.parse(content);
    const cards = tryTagNameCards(parsed);
    if (cards.length > 0) return cards;
  } catch {
    // Fall through to next strategy
  }

  // Strategy 2: Parse with attributes, match by @name attributes
  // Handles formats like <tts name="Text">...</tts>
  const attrCards = tryAttributeCards(content);
  if (attrCards.length > 0) return attrCards;

  return [];
}
