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

Write a SHORT visual scene description (1-2 sentences, max 35 words) that captures the card.

──────────────────────────────────────────────────────────
HARD RULES — these prevent the most common AI image errors:

1. SINGLE SUBJECT.
   Default to ONE person, ONE animal, or ONE object as the focal
   element. Multi-subject scenes produce extra limbs, merged faces,
   warped anatomy. Even if the card describes interaction between
   two parties (e.g. "telling a story", "having a conversation"),
   depict ONE person performing the action, not two.

2. ICONIC, NOT REALISTIC.
   Pictogram-style. "A coffee cup steaming on a wooden table" not
   "a busy cafe with people drinking coffee". The image should
   feel like a hand-illustrated symbol, not a photograph.

3. SPECIFIC VISUAL ANCHORS, NOT GENERIC LABELS.
   Bad: "a baseball field" — model can confuse with football,
   cricket, soccer pitches.
   Good: "a baseball diamond viewed from behind home plate, with
   the pitcher's mound visible in the centre".
   Always give the model 2-3 unmistakable anchor details for the
   specific subject category.

4. NO TEXT, NO LETTERS, NO NUMBERS, NO SIGNS, NO LABELS.
   Image generators routinely hallucinate text. Pre-empt this by
   never describing scenes with text, signage, or readable surfaces.

5. CONCRETE PHYSICAL DETAILS.
   Name actual objects (a brass key, a clay teapot, a wool scarf
   knitted in red and grey). Avoid abstract concepts that the model
   has no visual vocabulary for ("freedom", "thoughtfulness").
──────────────────────────────────────────────────────────

CONTENT-TYPE GUIDANCE:

- IDIOMS / FIGURATIVE PHRASES:
  • If the metaphor has an English-shared visual (e.g. "take the
    bull by the horns", "kill two birds with one stone"), depict
    the LITERAL imagery — that's the iconic universal shorthand.
  • If the literal imagery would mislead and there's no English
    equivalent (e.g. Spanish "Se me fue el santo al cielo" =
    literally "the saint went to the sky", figuratively "I lost
    my train of thought"), depict the FIGURATIVE meaning instead.

- VOCABULARY WORDS: depict the single most iconic referent.

- FACTUAL QUESTIONS: depict the answer's subject as a single object
  or scene. For sports/games, anchor with category-specific details
  (baseball: diamond + bat + ball; tennis: net + green court;
  basketball: orange ball + hoop + arc).

- ABSTRACT CONCEPTS: pick a single concrete metaphor (e.g. "patience"
  → a single sapling growing through a rock crack, not "people
  waiting").

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

  const client = new Anthropic({ apiKey });

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

Look for OBVIOUS errors that would make the image embarrassing to ship:
- Extra limbs, merged bodies, warped anatomy, malformed hands or faces
- Wrong sport / wrong equipment / wrong context (e.g. football goals on a baseball field)
- Visible text, letters, numbers, or signs (image gen often hallucinates these)
- Multiple subjects when one was implied
- Subject completely unrelated to the card concept

Reply on a SINGLE LINE in one of these two formats:
OK
or
BAD: <one short phrase describing the specific problem>

Be strict but not pedantic. Minor stylistic quirks are fine. Only flag things a user would notice and find wrong.`,
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
    .upload(fileName, bytes, { contentType, cacheControl: "31536000", upsert: false });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return supabase.storage.from(BUCKET).getPublicUrl(fileName).data.publicUrl;
}

/**
 * Full pipeline: Claude concept → FLUX image → Haiku validation →
 * (optional) one retry with the issue hinted in the prompt → Supabase
 * upload. tier="quick" uses FLUX schnell ($0.003), tier="premium" uses
 * FLUX dev ($0.025).
 *
 * Validation adds ~1-2s of latency and ~$0.0015 per image but cuts the
 * "embarrassing AI errors" rate (extra limbs, wrong sport, hallucinated
 * text) noticeably. We only retry once — if FLUX still gets it wrong
 * the second time, we ship what we have rather than burning credits in
 * a loop.
 */
export async function generateAndUploadImage(
  userId: string,
  front: string,
  back: string,
  tier: ImageTier = "quick"
): Promise<string> {
  const concept = await buildVisualConcept(front, back);
  const prompt = wrapConceptInStyle(concept, tier);

  // First attempt.
  let { bytes, ext } = await generateViaFal(prompt, tier);

  // Validate. If Haiku flags a problem, retry once with the issue
  // appended as an explicit "avoid this" hint to the prompt.
  const validation = await validateImage(bytes, ext, front, back);
  if (!validation.valid && validation.issue) {
    console.warn(
      `[image-gen] validation flagged "${validation.issue}" — retrying once`
    );
    const refinedPrompt = [
      prompt,
      `CRITICAL: the previous attempt had this issue: "${validation.issue}". Generate a different image that AVOIDS this problem.`,
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
  const { bytes, ext } = await generateViaFal(prompt, tier);
  return uploadBytes(userId, bytes, ext);
}
