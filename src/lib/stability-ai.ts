import { createClient as createServiceClient } from "@supabase/supabase-js";

const STABILITY_API_URL =
  "https://api.stability.ai/v2beta/stable-image/generate/core";

const BUCKET = "card-images";

/**
 * Build a flashcard-optimised prompt from the card text.
 * Rules:
 *  - Illustrative, not answer-revealing (no text, no labels, no letters)
 *  - Consistent style across a deck
 *  - Square aspect ratio for card thumbnails
 */
export function buildImagePrompt(
  cardFront: string,
  cardBack: string
): string {
  // Strip any markdown / HTML
  const clean = (s: string) => s.replace(/<[^>]*>/g, "").replace(/[#*_~`]/g, "").trim();
  const front = clean(cardFront);
  const back = clean(cardBack);

  return [
    `Educational flashcard illustration for the concept: "${front}".`,
    `The answer is "${back}" but DO NOT include any text, letters, numbers, words, or labels in the image.`,
    "Clean, modern flat illustration style with soft colours on a simple background.",
    "No watermarks, no borders, no text overlays.",
  ].join(" ");
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
      "text, letters, numbers, words, labels, watermark, signature, blurry, low quality"
  );
  form.append("aspect_ratio", opts.aspectRatio || "1:1");
  form.append("output_format", opts.outputFormat || "webp");

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
 * Generate an image via Stability AI and upload to Supabase Storage.
 * Returns the public URL.
 */
export async function generateAndUploadImage(
  userId: string,
  prompt: string
): Promise<string> {
  const { bytes, contentType } = await generateImageBytes({ prompt });

  // Determine extension from content type
  const extMap: Record<string, string> = {
    "image/webp": "webp",
    "image/png": "png",
    "image/jpeg": "jpg",
  };
  const ext = extMap[contentType] || "webp";
  const fileName = `${userId}/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Use service role client for storage uploads (server-side)
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
