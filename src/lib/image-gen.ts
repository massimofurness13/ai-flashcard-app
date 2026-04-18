import { createClient as createServiceClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { fal } from "@fal-ai/client";

const BUCKET = "card-images";

export type ImageTier = "quick" | "premium";

/**
 * Use Claude Haiku to translate a flashcard into a visual scene description.
 * Shared by both Quick and Premium tiers — the concept step is identical,
 * only the image model differs.
 */
async function buildVisualConcept(
  cardFront: string,
  cardBack: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return cardBack || cardFront;

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

Write a SHORT visual scene description (1-2 sentences, max 40 words) that captures the card. Rules:

- For idioms and figurative phrases, use this test:
  → If the SAME visual metaphor exists in English (e.g. "take the bull by the horns", "kill two birds with one stone", "the straw that broke the camel's back"), depict the LITERAL imagery — it's the iconic universal shorthand. Use the bull, the stone, the camel.
  → If the literal imagery would be misleading and has NO English equivalent (e.g. "Se me fue el santo al cielo" literally = "the saint went to the sky", figuratively = "I lost my train of thought"), depict the FIGURATIVE meaning instead.
  → When unsure, include the iconic visual element (bull, horns, etc.) AND hint at the figurative meaning through the scene (a determined person gripping bull's horns, for example).
- For vocabulary words, depict what they represent.
- For factual questions, depict the answer's subject.
- Describe ONLY visual elements (people, objects, settings, colours, mood).
- NEVER include any text, letters, words, signs, labels, or writing in your description.
- Be specific and concrete — name actual objects and compositions.

Output ONLY the scene description. No preamble, no quotes.`,
        },
      ],
    });

    const block = message.content.find((b) => b.type === "text");
    if (block && block.type === "text") return block.text.trim();
  } catch {
    // fall through
  }

  return cardBack || cardFront;
}

/**
 * Style preset differs per tier so Premium looks visibly more elaborate
 * than Quick, giving users a real reason to spend 5 credits instead of 1.
 */
function wrapConceptInStyle(concept: string, tier: ImageTier): string {
  if (tier === "premium") {
    return [
      concept,
      "Rich painterly illustration with vivid colours, detailed background, soft lighting, atmospheric depth.",
      "Polished artwork with refined composition and subtle textures.",
      "No text, no letters, no numbers, no writing, no signs, no labels, no words anywhere in the image.",
    ].join(" ");
  }
  return [
    concept,
    "Flat vector illustration style with soft pastel colours.",
    "Clean minimal background. Iconic, simple shapes.",
    "No text, no letters, no numbers, no writing, no signs, no labels, no words anywhere in the image.",
  ].join(" ");
}

async function generateViaFal(
  prompt: string,
  tier: ImageTier
): Promise<{ bytes: Buffer; ext: string }> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY is not set");

  fal.config({ credentials: apiKey });

  const endpoint = tier === "premium" ? "fal-ai/flux/dev" : "fal-ai/flux/schnell";
  const steps = tier === "premium" ? 28 : 4;

  const result = await fal.subscribe(endpoint, {
    input: {
      prompt,
      image_size: "square",
      num_inference_steps: steps,
      num_images: 1,
      enable_safety_checker: false,
    },
  });

  const imageUrl = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
  if (!imageUrl) throw new Error(`No image URL from ${endpoint}`);

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
  const arrayBuffer = await imgRes.arrayBuffer();
  return { bytes: Buffer.from(arrayBuffer), ext: "png" };
}

async function uploadBytes(
  userId: string,
  bytes: Buffer,
  ext: string
): Promise<string> {
  const fileName = `${userId}/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }

  const supabase = createServiceClient(supabaseUrl, serviceKey);
  const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, bytes, { contentType, cacheControl: "3600", upsert: false });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return supabase.storage.from(BUCKET).getPublicUrl(fileName).data.publicUrl;
}

/**
 * Full pipeline: Claude concept → FLUX image → Supabase upload.
 * tier="quick" uses FLUX schnell ($0.003), tier="premium" uses FLUX dev ($0.025).
 */
export async function generateAndUploadImage(
  userId: string,
  front: string,
  back: string,
  tier: ImageTier = "quick"
): Promise<string> {
  const concept = await buildVisualConcept(front, back);
  const prompt = wrapConceptInStyle(concept, tier);
  const { bytes, ext } = await generateViaFal(prompt, tier);
  return uploadBytes(userId, bytes, ext);
}

/**
 * Direct prompt generation — for callers that already have a prompt
 * (e.g. custom user prompts). Defaults to Quick tier.
 */
export async function generateAndUploadFromPrompt(
  userId: string,
  prompt: string,
  tier: ImageTier = "quick"
): Promise<string> {
  const { bytes, ext } = await generateViaFal(prompt, tier);
  return uploadBytes(userId, bytes, ext);
}
