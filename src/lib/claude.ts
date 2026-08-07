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
  /** Language for the FRONT of each card, e.g. "Spanish (Spain)". */
  frontLanguage?: string;
  /** Language for the BACK of each card, e.g. "English (UK)". When this
   *  differs from frontLanguage, the generator TRANSLATES rather than
   *  copying the source text onto both sides. */
  backLanguage?: string;
  /** Opt IN to per-card hints. OFF by default — the generator was producing
   *  unwanted hints (e.g. turning bracketed "[LatAm: …]" notes into hints),
   *  so hints now only appear when the caller explicitly asks for them. */
  includeHints?: boolean;
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
- NEVER emit a "hint". Bracketed asides and warnings in the source (e.g. "[LatAm: jeans / bluyín]", "⚠️ ...") are NOT hints and must never become one — fold that context into the front/back wording if it belongs on the card, otherwise drop it.

## Mode 2 — PEDAGOGICAL (only when material is truly prose)

Use this mode ONLY when the material is flowing paragraphs, textbook prose, lecture notes, or an essay — with no existing card structure. Then create Q&A cards covering the key concepts.

## When in doubt

Default to EXTRACTION. It is better to faithfully extract what the user gave you than to invent content they did not ask for.

## Output

Return ONLY a JSON array. No markdown, no preamble, no trailing text. Each object has:
- "front": string (the prompt/term/question side)
- "back": string (the answer/definition/translation side)

Do NOT include a "hint" field (or any other field) UNLESS the user's message explicitly asks for hints. By default every card is front + back only.

If extraction yields 10 pairs, return exactly 10 cards.`;

// ── Model selection with automatic fallback ──────────────────────────
//
// We ASK for PRIMARY_MODEL first. If Anthropic ever retires it (exactly
// what broke generation when claude-sonnet-4 was retired on 2026-06-15),
// the request 404s — and instead of failing, we query Anthropic's live
// Models API for the newest available model in a preferred family and
// retry. The resolved model is cached for the rest of the process, so the
// 404 is paid at most once. Net effect: a model retirement degrades to one
// slightly slower request instead of a total outage, with NO code change.
const PRIMARY_MODEL = "claude-sonnet-5";

// Preferred model families, best first, used only when auto-picking a
// replacement. Sonnet is the balanced tier we run on; Opus and Haiku are
// safety nets so generation survives even if the whole Sonnet line is gone.
const MODEL_FAMILY_PREFERENCE = ["claude-sonnet-", "claude-opus-", "claude-haiku-"];

// Remembered replacement once PRIMARY_MODEL becomes unavailable. Null = use
// PRIMARY_MODEL. Module-scoped, so it persists across requests in one server
// process (reset on redeploy/restart).
let resolvedModel: string | null = null;

/** Did this error mean "that model doesn't exist" (retired / unknown ID)? */
export function isModelUnavailable(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  const type = (err as { error?: { error?: { type?: string } } } | null)?.error
    ?.error?.type;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    status === 404 ||
    type === "not_found_error" ||
    /not_found_error|model[^.]*not\s*found|not\s*found[^.]*model/i.test(msg)
  );
}

/**
 * Ask the Models API which models this account can use right now and return
 * the newest one from the most-preferred family. This is what makes
 * generation self-healing: PRIMARY_MODEL's successor is discovered at
 * runtime, so a future retirement needs no code change.
 */
export async function resolveFallbackModel(client: Anthropic): Promise<string> {
  const { data: models } = await client.models.list({ limit: 100 });
  // created_at is ISO-8601, which sorts chronologically as a plain string.
  const newestFirst = (a: { created_at: string }, b: { created_at: string }) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;

  for (const family of MODEL_FAMILY_PREFERENCE) {
    const best = models
      .filter((m) => m.id.startsWith(family))
      .sort(newestFirst)[0];
    if (best) return best.id;
  }
  const newest = [...models].sort(newestFirst)[0];
  if (newest) return newest.id;
  throw new Error("No Claude models are available on this account");
}

/**
 * messages.create that survives model retirement. Tries the current model;
 * on a "model not found" error, resolves a live replacement from the Models
 * API, remembers it, and retries once. Any other error propagates unchanged.
 */
export async function createWithModelFallback(
  client: Anthropic,
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model">,
): Promise<Anthropic.Message> {
  const model = resolvedModel ?? PRIMARY_MODEL;
  try {
    return await client.messages.create({ ...params, model });
  } catch (err) {
    if (!isModelUnavailable(err)) throw err;
    const fallback = await resolveFallbackModel(client);
    resolvedModel = fallback;
    console.warn(
      `[claude] model "${model}" is unavailable (likely retired); ` +
        `falling back to "${fallback}".`,
    );
    return await client.messages.create({ ...params, model: fallback });
  }
}

/** Test-only: reset the cached replacement model between cases. */
export function __resetModelCache(): void {
  resolvedModel = null;
}

/**
 * Pull the JSON array out of a model response. The system prompt asks for a
 * bare array, but we slice from the first "[" to the last "]" so any stray
 * preamble or code fence the model adds is tolerated. We used to force this
 * with an assistant prefill of "[", but assistant prefills return a 400 on
 * Sonnet 5 and newer models — so we parse defensively instead.
 */
function extractJsonArray(text: string): string {
  const raw = text.trim();
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON array found in Claude response");
  }
  return raw.slice(start, end + 1);
}

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
  const { topic, material, frontLanguage, backLanguage, includeHints } =
    options;

  const hasMaterial = material && material.trim().length > 0;

  // Hints are opt-in. The system prompt suppresses them by default; this
  // line is the ONLY thing that turns them on, appended to the user message
  // so the model treats it as the explicit request the prompt requires.
  const hintRule = includeHints
    ? '\n\nAlso include a short "hint" field on each card.'
    : "";

  // Translation mode: the user picked two DIFFERENT languages for the
  // front and back, so they want language-learning cards — front in one
  // language, back as the translation in the other. This OVERRIDES the
  // system prompt's default "extraction = copy verbatim" behaviour,
  // which was the bug that produced Spanish-on-both-sides cards.
  const isTranslation =
    !!frontLanguage &&
    !!backLanguage &&
    frontLanguage.trim().toLowerCase() !== backLanguage.trim().toLowerCase();

  // Block prepended to the user message in translation mode. Kept at the
  // TOP so it dominates the system prompt's extraction rules.
  const translationDirective = isTranslation
    ? `LANGUAGE-LEARNING CARDS — TRANSLATION MODE (this overrides the default extraction rules).
The learner studies ${frontLanguage} and wants the back of each card in ${backLanguage}.

For every card:
- "front": text in ${frontLanguage}. Prefer a complete, natural example SENTENCE in ${frontLanguage} (not a bare word). If the source gives a vocabulary word together with an example sentence, put the SENTENCE on the front.
- "back": a faithful, natural ${backLanguage} translation of the front. The back MUST be written in ${backLanguage} — never repeat the ${frontLanguage} text or leave it untranslated.

Do NOT add a "hint" field. Bracketed regional notes like "[LatAm: …]" and "⚠️" warnings are context for choosing the wording, NOT hints — never emit them as a hint field.

Never put the same language on both sides. One source item = exactly one card.

`
    : "";

  const userMessage = hasMaterial
    ? `${translationDirective}Topic (context only — do NOT generate cards "about" this topic unless the material is pure prose): "${topic}"

The user has pasted the following material.${
        isTranslation
          ? ` Turn each item into one translation card as instructed above.`
          : " Follow the EXTRACTION vs PEDAGOGICAL decision in your instructions."
      }

<material>
${material}
</material>

Return the JSON array now.`
    : isTranslation
      ? `${translationDirective}The learner wants ${frontLanguage} → ${backLanguage} cards about "${topic}" (no material provided — invent useful cards that cover it well).

Generate 8-15 cards, progressing from simple to more advanced. Each "front" is a natural ${frontLanguage} sentence; each "back" is its ${backLanguage} translation.

Return the JSON array now.`
      : `The user wants flashcards about this topic (no material provided — invent cards that cover it well):

"${topic}"

Generate 8-15 high-quality cards covering breadth of the topic, progressing from fundamental to advanced. Each card should be a specific, testable question with a clear answer.

Return the JSON array now.`;

  const message = await createWithModelFallback(client, {
    max_tokens: 8192,
    // Thinking off so the full token budget goes to the JSON output and
    // latency stays predictable. Sonnet 5 defaults to adaptive thinking,
    // which would otherwise eat into max_tokens on large extractions.
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage + hintRule }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const cards: GeneratedCard[] = JSON.parse(extractJsonArray(textBlock.text));

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

  const message = await createWithModelFallback(client, {
    max_tokens: 8192,
    thinking: { type: "disabled" },
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
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const cards: GeneratedCard[] = JSON.parse(extractJsonArray(textBlock.text));

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
