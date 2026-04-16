import { XMLParser } from "fast-xml-parser";
import type { ParsedCard } from "./import-csv";

const FRONT_KEYS = ["front", "question", "term", "word", "prompt"];
const BACK_KEYS = ["back", "answer", "definition", "meaning", "response"];
const HINT_KEYS = ["hint", "clue", "mnemonic", "note"];
const TAGS_KEYS = ["tags", "tag", "category", "label"];

function matchKey(obj: Record<string, unknown>, candidates: string[]): string | undefined {
  const keys = Object.keys(obj);
  for (const candidate of candidates) {
    const match = keys.find((k) => k.toLowerCase() === candidate);
    if (match && typeof obj[match] === "string") return obj[match] as string;
  }
  return undefined;
}

function isCardLike(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const rec = obj as Record<string, unknown>;
  const keys = Object.keys(rec).map((k) => k.toLowerCase());
  return (
    keys.some((k) => FRONT_KEYS.includes(k)) &&
    keys.some((k) => BACK_KEYS.includes(k))
  );
}

function findCardNodes(parsed: unknown): Record<string, unknown>[] {
  if (!parsed || typeof parsed !== "object") return [];

  // If it's an array, check each element
  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && isCardLike(parsed[0])) return parsed;
    // Recurse into array elements
    for (const item of parsed) {
      const found = findCardNodes(item);
      if (found.length > 0) return found;
    }
    return [];
  }

  const obj = parsed as Record<string, unknown>;

  // Check each value in the object
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      if (value.length > 0 && isCardLike(value[0])) return value;
    } else if (isCardLike(value)) {
      return [value as Record<string, unknown>];
    }
    // Recurse deeper
    if (value && typeof value === "object") {
      const found = findCardNodes(value);
      if (found.length > 0) return found;
    }
  }

  return [];
}

export function parseXML(content: string): ParsedCard[] {
  const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });

  let parsed: unknown;
  try {
    parsed = parser.parse(content);
  } catch {
    return [];
  }

  const nodes = findCardNodes(parsed);

  const results: ParsedCard[] = [];

  for (const node of nodes) {
    const front = matchKey(node, FRONT_KEYS);
    const back = matchKey(node, BACK_KEYS);
    if (!front || !back) continue;

    const trimmedFront = front.trim();
    const trimmedBack = back.trim();
    if (!trimmedFront || !trimmedBack) continue;

    const card: ParsedCard = { front: trimmedFront, back: trimmedBack };
    const hint = matchKey(node, HINT_KEYS)?.trim();
    const tags = matchKey(node, TAGS_KEYS)?.trim();
    if (hint) card.hint = hint;
    if (tags) card.tags = tags;
    results.push(card);
  }

  return results;
}
