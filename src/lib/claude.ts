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

export async function generateFlashcards(
  options: GenerateOptions
): Promise<GeneratedCard[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });
  const { topic, material } = options;

  const materialSection = material
    ? `\n\nThe user has provided the following study material to base the cards on:\n<material>\n${material}\n</material>`
    : "";

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Generate flashcards about: "${topic}"${materialSection}

Generate as many cards as appropriate to thoroughly cover the topic or material provided. For a simple topic, this might be 5-10 cards. For detailed study material, generate enough cards to cover all key concepts (could be 20, 30, or more).

Return ONLY a JSON array with no other text. Each object must have:
- "front": the question or prompt (concise, clear)
- "back": the answer or explanation (thorough but not overly long)
- "hint": a brief hint to help recall (optional, 1 short sentence)

Guidelines:
- Cover the topic breadth: don't repeat the same sub-topic
- Progress from fundamental to advanced concepts
- Use clear, unambiguous language
- Front should be a specific question, not vague
- Back should directly answer the front
- Hints should nudge toward the answer without giving it away

Return the JSON array:`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let jsonStr = textBlock.text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const cards: GeneratedCard[] = JSON.parse(jsonStr);

  if (!Array.isArray(cards)) {
    throw new Error("Response is not an array");
  }

  return cards.map((card) => ({
    front: String(card.front),
    back: String(card.back),
    hint: card.hint ? String(card.hint) : undefined,
  }));
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
    messages: [
      {
        role: "user",
        content: `Extract flashcards from this file. The file is named "${fileName}".

<file_content>
${truncated}
</file_content>

Parse the content and extract every card/entry as a flashcard. For each card, determine which text is the "front" (question/prompt/term) and which is the "back" (answer/definition/translation).

Return ONLY a JSON array with no other text. Each object must have:
- "front": the question, term, or prompt side
- "back": the answer, definition, or translation side
- "hint": a brief hint if one exists in the data (optional)

Do NOT skip any cards. Extract ALL of them. Return the JSON array:`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let jsonStr = textBlock.text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
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
