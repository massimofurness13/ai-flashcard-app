import { createClient as createServiceClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { fal } from "@fal-ai/client";
import { checkedGeneratedImage, InvalidGeneratedImageError, MAX_GENERATED_IMAGE_BYTES } from "./image-integrity";

const BUCKET = "card-images";

export type ImageTier = "quick" | "premium";

/**
 * Send the generated image back to Haiku with vision and ask it to
 * verify the result actually matches what we asked for. Cheap insurance
 * against the most common FLUX failure modes (anatomy errors, wrong
 * sport equipment, hallucinated text). On a "no" answer we retry once
 * with a hint about what went wrong.
 *
 * Returns { valid: true } on:
 *   - Haiku saying YES
 *   - Haiku errors (don't block on validation infra failing)
 *   - Missing API key
 * Returns { valid: false, issue: string } when Haiku flags a real problem.
 */
async function validateImage(
  imageBytes: Buffer,
  ext: string,
  cardFront: string,
  cardBack: string
): Promise<{ valid: boolean; issue?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { valid: true };

  const client = new Anthropic({ apiKey, timeout: 10000, maxRetries: 0 });

  // Anthropic's vision API takes base64-encoded image data with an
  // explicit media type. We support png/jpeg/webp (whatever FLUX
  // returned upstream).
  const mediaType =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg";
  const base64 = imageBytes.toString("base64");

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: `This image is meant to illustrate a flashcard.
Front: "${cardFront}"
Back: "${cardBack}"

Check whether the picture clearly shows the intended meaning. Flag an unrelated scene, obvious visual defects, or captions that give away the answer.

Reply on a SINGLE LINE in one of these two formats:
OK
or
BAD: <one short phrase describing the specific problem>`,
            },
          ],
        },
      ],
    });

    const block = message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { valid: true };

    const reply = block.text.trim();
    if (/^OK\b/i.test(reply)) return { valid: true };
    if (/^BAD\b/i.test(reply)) {
      const issue = reply.replace(/^BAD:?\s*/i, "").trim() || "unspecified";
      return { valid: false, issue };
    }
    // Ambiguous reply — assume valid, don't block the user.
    return { valid: true };
  } catch {
    return { valid: true };
  }
}

async function generateViaFal(
  prompt: string,
  tier: ImageTier
): Promise<{ bytes: Buffer; ext: string }> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY is not set");

  fal.config({ credentials: apiKey });

  const quick = tier === "quick";
  const endpoint = quick ? "fal-ai/flux-2/klein/9b" : "fal-ai/flux-2";
  const size = quick ? 768 : 1024;
  const input = {
    prompt,
    image_size: { width: size, height: size },
    num_images: 1,
    output_format: "png",
    enable_safety_checker: true,
  };
  const result = await fal.subscribe(endpoint, { input });
  const data = result.data as { images?: { url?: string }[]; has_nsfw_concepts?: boolean[] };
  if (data.has_nsfw_concepts?.[0]) throw new InvalidGeneratedImageError("provider filtered this image");
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error(`No image URL from ${endpoint}`);

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
  if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
  if (Number(imgRes.headers.get("content-length")) > MAX_GENERATED_IMAGE_BYTES) throw new InvalidGeneratedImageError("invalid file size");
  const arrayBuffer = await imgRes.arrayBuffer();
  return checkedGeneratedImage(Buffer.from(arrayBuffer));
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
    .upload(fileName, bytes, { contentType, cacheControl: "31536000", upsert: false });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return supabase.storage.from(BUCKET).getPublicUrl(fileName).data.publicUrl;
}

export async function generateAndUploadImage(
  userId: string,
  front: string,
  back: string,
  tier: ImageTier = "quick"
): Promise<string> {
  const sides = [front.trim(), back.trim()].filter(Boolean);
  const prompt = `Illustrate the meaning of this flashcard without captions.\n${sides.join("\n")}`;

  // One shared retry budget for hard file failures and semantic corrections.
  let usedRetry = false;
  let result;
  try { result = await generateViaFal(prompt, tier); }
  catch (error) {
    if (!(error instanceof InvalidGeneratedImageError)) throw error;
    usedRetry = true;
    result = await generateViaFal(prompt, tier);
  }
  let { bytes, ext } = result;

  // Validate. If Haiku flags a problem, retry once with the issue
  // appended as an explicit "avoid this" hint to the prompt.
  const validation = await validateImage(bytes, ext, front, back);
  if (!usedRetry && !validation.valid && validation.issue) {
    console.warn(
      `[image-gen] validation flagged "${validation.issue}" — retrying once`
    );
    const refinedPrompt = [
      prompt,
      `Correction: ${validation.issue}`,
    ].join(" ");
    try {
      const retry = await generateViaFal(refinedPrompt, tier);
      bytes = retry.bytes;
      ext = retry.ext;
    } catch (err) {
      // Retry network error — keep the original. Better a slightly-off
      // image than no image.
      console.warn(
        `[image-gen] retry failed (${err instanceof Error ? err.message : err}), using original`
      );
    }
  }

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
  let result;
  try { result = await generateViaFal(prompt, tier); }
  catch (error) {
    if (!(error instanceof InvalidGeneratedImageError)) throw error;
    result = await generateViaFal(prompt, tier);
  }
  return uploadBytes(userId, result.bytes, result.ext);
}
