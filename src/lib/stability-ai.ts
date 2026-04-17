import { createClient as createServiceClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const STABILITY_API_URL =
  "https://api.stability.ai/v2beta/stable-image/generate/core";

const BUCKET = "card-images";

/**
 * Use Claude Haiku to translate a flashcard into a visual scene description.
 * This solves two problems with passing raw card text to SDXL:
 *   1. SDXL tries to render foreign text literally on the image
 *   2. SDXL doesn't understand idioms/translations — it fixates on literal words
 *
 * Claude understands the MEANING and describes a scene that captures it.
 */
async function buildVisualConcept(
  cardFront: string,
  cardBack: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fall back: use the back text if available (often English translation)
    return cardBack || cardFront;
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You write visual scene descriptions for educational flashcard illustrations.

Card front: "${cardFront}"
Card back: "${cardBack}"

Write a SHORT visual scene description (1-2 sentences, max 40 words) that captures the MEANING of this card. Rules:

- If the card is an idiom or phrase, depict the FIGURATIVE meaning, not the literal words.
  Example: "Se me fue el santo al cielo" means "I lost my train of thought" — depict a confused person with thoughts drifting away, NOT a saint going to the sky.
- If the card is a vocabulary word, depict what it represents.
- If the card is a factual question, depict the answer's subject.
- Describe ONLY visual elements (people, objects, settings, colours, mood).
- NEVER include any text, letters, words, signs, labels, or writing in your description.
- Be specific and concrete — name actual objects and compositions.
- Avoid anything that could be rendered as text by the image model.

Output ONLY the scene description. No preamble, no quotes.`,
        },
      ],
    });

    const block = message.content.find((b) => b.type === "text");
    if (block && block.type === "text") {
      return block.text.trim();
    }
  } catch {
    // Fall through to fallback
  }

  return cardBack || cardFront;
}

/**
 * Build the final SDXL prompt from a visual concept description.
 * Adds styling and reinforces the "no text" constraint.
 */
function buildImagePromptFromConcept(concept: string): string {
  return [
    concept,
    "Flat vector illustration style with soft pastel colours.",
    "Clean minimal background. Iconic, simple shapes.",
    "No text, no letters, no numbers, no writing, no signs, no labels, no words anywhere in the image.",
  ].join(" ");
}

/**
 * Legacy prompt builder — kept for backward compatibility with direct
 * prompt-based endpoints. Prefer buildVisualConcept + buildImagePromptFromConcept.
 */
export function buildImagePrompt(
  cardFront: string,
  cardBack: string
): string {
  const clean = (s: string) => s.replace(/<[^>]*>/g, "").replace(/[#*_~`]/g, "").trim();
  return buildImagePromptFromConcept(`An illustration representing: ${clean(cardBack || cardFront)}`);
}

interface GenerateOptions {
  prompt: string;
  /** Negative prompt — things to avoid */
  negativePrompt?: string;
  /** Aspect ratio. Default "1:1" */
  aspectRatio?: string;
  /** Output format. Default "webp" */
  outputFormat?: "webp" | "png" | "jpeg";
}

/**
 * Call Stability AI Core to generate an image.
 * Returns the raw image bytes + content type.
 */
export async function generateImageBytes(
  opts: GenerateOptions
): Promise<{ bytes: Buffer; contentType: string }> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY is not set. Add it to your .env file.");
  }

  const form = new FormData();
  form.append("prompt", opts.prompt);
  form.append(
    "negative_prompt",
    opts.negativePrompt ||
      "text, letters, numbers, words, labels, captions, signs, writing, typography, watermark, signature, logo, blurry, low quality, realistic photo, photography"
  );
  form.append("aspect_ratio", opts.aspectRatio || "1:1");
  form.append("output_format", opts.outputFormat || "webp");
  form.append("style_preset", "digital-art");

  const res = await fetch(STABILITY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "image/*",
    },
    body: form,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(
      `Stability AI error ${res.status}: ${errorText}`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  const contentType =
    res.headers.get("content-type") || "image/webp";

  return {
    bytes: Buffer.from(arrayBuffer),
    contentType,
  };
}

/**
 * Full pipeline: Claude translates card → visual concept → SDXL image → Supabase.
 * Returns the public URL.
 */
export async function generateAndUploadImage(
  userId: string,
  cardFrontOrPrompt: string,
  cardBack?: string
): Promise<string> {
  // If cardBack is provided, use the two-step concept builder.
  // Otherwise treat cardFrontOrPrompt as a raw prompt (legacy callers).
  const finalPrompt = cardBack !== undefined
    ? buildImagePromptFromConcept(await buildVisualConcept(cardFrontOrPrompt, cardBack))
    : cardFrontOrPrompt;

  const { bytes, contentType } = await generateImageBytes({ prompt: finalPrompt });

  const extMap: Record<string, string> = {
    "image/webp": "webp",
    "image/png": "png",
    "image/jpeg": "jpg",
  };
  const ext = extMap[contentType] || "webp";
  const fileName = `${userId}/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }

  const supabase = createServiceClient(supabaseUrl, serviceKey);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, bytes, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
