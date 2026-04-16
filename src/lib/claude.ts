import Anthropic from "@anthropic-ai/sdk";

export interface GeneratedCard {
  front: string;
  back: string;
  hint?: string;
}

export interface GenerateOptions {
  topic: string;
  count?: number;
  material?: string;
}

const SYSTEM_PROMPT = `You are a precise flashcard creator. Your job is to turn the user's material into flashcards.

CRITICAL: Always decide which of two modes applies:

## Mode 1 — EXTRACTION (default when material looks like card data)

Use this mode when the material contains any of:
- Word pairs or translations (Spanish ↔ English, term ↔ definition, etc.)
- Numbered or bulleted lists of front/back pairs
- Tables with two columns (e.g. "# Front | Back")
- CSV-style or TSV-style rows
- Question-answer pairs already written
- Any list where each entry clearly has two sides

In extraction mode:
- One row/pair in = one card out. Nothing more, nothing less.
- Use the user's wording VERBATIM. Do NOT rewrite, simplify, or explain.
- Do NOT invent new cards, questions, grammar notes, or concepts.
- Do NOT turn statements into questions (e.g. "El gato es negro" stays as front, not "What color is the cat?").
- For language pairs, keep original wording: front = first-listed language, back = second-listed language (or whichever is clearly the source vs target).
- Strip conversational framing ("Here are some flashcards:", "If you'd like..."). Only extract the actual card data.
- Omit hints unless the data explicitly contains one.

## Mode 2 — PEDAGOGICAL (only when material is truly prose)

Use this mode ONLY when the material is flowing paragraphs, textbook prose, lecture notes, or an essay — with no existing card structure. Then create Q&A cards covering the key concepts.

## When in doubt

Default to EXTRACTION. It is better to faithfully extract what the user gave you than to invent content they did not ask for.

## Output

Return ONLY a JSON array. No markdown, no preamble, no trailing text. Each object has:
- "front": string (the prompt/term/question side)
- "back": string (the answer/definition/translation side)
- "hint": string (optional; only include if the source material had a hint)

If extraction yields 10 pairs, return exactly 10 cards.`;

/**
 * Generate flashcards from a topic (invent mode) or material (extract-first mode).
 */
export async function generateFlashcards(
  options: GenerateOptions
): Promise<GeneratedCard[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });
  const { topic, material } = options;

  const hasMaterial = material && material.trim().length > 0;

  const userMessage = hasMaterial
    ? `Topic (context only — do NOT generate cards "about" this topic unless the material is pure prose): "${topic}"

The user has pasted the following material. Follow the EXTRACTION vs PEDAGOGICAL decision in your instructions.

<material>
${material}
</material>

Return the JSON array now.`
    : `The user wants flashcards about this topic (no material provided — invent cards that cover it well):

"${topic}"

Generate 8-15 high-quality cards covering breadth of the topic, progressing from fundamental to advanced. Each card should be a specific, testable question with a clear answer.

Return the JSON array now.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userMessage },
      // Pre-fill the assistant's response to force JSON-only output
      { role: "assistant", content: "[" },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Prepend the "[" we used to force JSON output
  let jsonStr = "[" + textBlock.text.trim();

  // Strip any trailing code fence or text after the JSON
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.replace(/```$/, "").trim();
  }

  // Find the end of the JSON array (in case model added trailing text)
  const lastBracket = jsonStr.lastIndexOf("]");
  if (lastBracket !== -1) {
    jsonStr = jsonStr.slice(0, lastBracket + 1);
  }

  const cards: GeneratedCard[] = JSON.parse(jsonStr);

  if (!Array.isArray(cards)) {
    throw new Error("Response is not an array");
  }

  return cards
    .map((card) => ({
      front: String(card.front || "").trim(),
      back: String(card.back || "").trim(),
      hint: card.hint ? String(card.hint).trim() : undefined,
    }))
    .filter((c) => c.front.length > 0 && c.back.length > 0);
}

/**
 * Use Claude to extract flashcards from any file content that the
 * structured parsers couldn't handle.
 */
export async function extractCardsWithAI(
  content: string,
  fileName: string
): Promise<GeneratedCard[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });

  // Truncate very large files to stay within token limits
  const truncated = content.length > 50000 ? content.slice(0, 50000) : content;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract flashcards from this file. The file is named "${fileName}".

<file_content>
${truncated}
</file_content>

Use EXTRACTION mode — this is card data. Return every card, verbatim.`,
      },
      { role: "assistant", content: "[" },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let jsonStr = "[" + textBlock.text.trim();

  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.replace(/```$/, "").trim();
  }

  const lastBracket = jsonStr.lastIndexOf("]");
  if (lastBracket !== -1) {
    jsonStr = jsonStr.slice(0, lastBracket + 1);
  }

  const cards: GeneratedCard[] = JSON.parse(jsonStr);

  if (!Array.isArray(cards)) {
    throw new Error("Response is not an array");
  }

  return cards
    .map((card) => ({
      front: String(card.front || "").trim(),
      back: String(card.back || "").trim(),
      hint: card.hint ? String(card.hint).trim() : undefined,
    }))
    .filter((c) => c.front.length > 0 && c.back.length > 0);
}
