import { createClient as createServiceClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { fal } from "@fal-ai/client";

const BUCKET = "card-images";

export type ImageTier = "quick" | "premium";

/**
 * Use Claude Haiku to translate a flashcard into a visual scene description.
 * Shared by both Quick and Premium tiers — the concept step is identical,
 * only the image model differs.
 *
 * ── Prompt versioning ─────────────────────────────────────────────
 * V1: the first "memorable, character-led" rewrite shipped in c19daab.
 *     Adds the memorable-hook requirement (emotion / motion / surprise /
 *     sensory) and biases toward characters over static objects.
 *
 * V2: pushes harder on caricature, outrageous-in-service-of-meaning,
 *     and stylistic anchors. Designed to test whether more aggressive
 *     exaggeration produces more memorable results without breaking
 *     FLUX's anatomy (single-subject discipline preserved).
 *
 * Pick via env: IMAGE_PROMPT_VERSION=v1|v2. Default v2. Both kept in
 * the codebase so we can flip back instantly without a code deploy
 * if v2 underperforms in user testing.
 */
function buildPrompt(cardFront: string, cardBack: string): string {
  const version = process.env.IMAGE_PROMPT_VERSION === "v1" ? "v1" : "v2";
  return version === "v1"
    ? buildPromptV1(cardFront, cardBack)
    : buildPromptV2(cardFront, cardBack);
}

function buildPromptV1(cardFront: string, cardBack: string): string {
  return `You write visual scene descriptions for educational flashcard illustrations. The goal is MEMORABILITY — images that stick in the user's mind so the card sticks too. Bland-but-correct illustrations are useless; we need scenes the brain can't help but encode.

Card front: "${cardFront}"
Card back: "${cardBack}"

Write a SHORT visual scene description (1-2 sentences, max 40 words) that captures the card.

──────────────────────────────────────────────────────────
HARD RULES — these prevent the most common AI image errors:

1. SINGLE SUBJECT.
   ONE person, ONE animal, or ONE object as the focal element.
   Multi-subject scenes produce extra limbs, merged faces, warped
   anatomy. Even if the card describes interaction between two
   parties ("telling a story", "having a conversation"), depict
   ONE person performing the action, not two.

2. PREFER A CHARACTER OVER A STATIC OBJECT.
   Faces and emotional expressions are what humans remember best.
   When the card can be embodied by a person or animal, choose
   that path — a person USING / FEELING / REACTING TO the concept,
   not a still-life of the concept alone. Reserve "object only"
   for cases where no human/animal is plausible (e.g. "what is the
   capital of France" → Eiffel Tower; "molecule" → molecule diagram).

3. ICONIC, NOT REALISTIC.
   Storybook-illustration sensibility, not photography. The image
   should feel like an arresting single frame from a story.

4. SPECIFIC VISUAL ANCHORS, NOT GENERIC LABELS.
   Bad: "a baseball field" — model can confuse with football,
   cricket, soccer pitches.
   Good: "a baseball diamond viewed from behind home plate, with
   the pitcher's mound visible in the centre".
   Always give the model 2-3 unmistakable anchor details.

5. NO TEXT, NO LETTERS, NO NUMBERS, NO SIGNS, NO LABELS.
   Image generators routinely hallucinate text. Never describe
   scenes containing readable surfaces.

6. CONCRETE PHYSICAL DETAILS.
   Name actual objects (a brass key, a clay teapot, a wool scarf
   knitted in red and grey). Avoid abstract words the model has no
   visual vocabulary for ("freedom", "thoughtfulness").
──────────────────────────────────────────────────────────

THE MEMORABLE-HOOK REQUIREMENT:

Every scene must include AT LEAST ONE of these (more is better,
but not at the cost of breaking rule #1):

  (a) A vivid emotional state — name a specific facial expression
      and body language. "Wide-eyed and mid-laugh, shoulders
      thrown back" beats "looking happy". "Brows knit, jaw
      clenched, fists tight at sides" beats "frustrated".

  (b) Mid-motion action — caught in the act, not posed. "Spaghetti
      flying off a fork mid-twirl" beats "eating spaghetti".

  (c) ONE small surprising/exaggerated element that reinforces the
      meaning — impossible scale, a comedic prop, a vivid sensory
      anchor. "An old woman blowing on a soup bowl big enough to
      bathe in" for a card about steam/heat. "A tiny librarian
      atop a teetering stack of books" for a card about
      organisation. Bizarre BUT in service of meaning, never
      random surrealism. NEVER add a second character or warped
      anatomy in pursuit of bizarreness.

  (d) A strong sensory cue — steam curling, sparks flying, water
      splashing, sharp colour contrast (a bright red object
      against a muted background). Things that make the eye stop.

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

- VOCABULARY WORDS: depict a person USING or REACTING TO the word's
  referent rather than the referent alone, when plausible.
  "Cup" → a child gleefully holding an oversized mug with both
  hands, steam curling up.

- FACTUAL QUESTIONS: depict the answer's subject as a single
  object or scene. For sports/games, anchor with category-specific
  details (baseball: diamond + bat + ball; tennis: net + green
  court; basketball: orange ball + hoop + arc).

- ABSTRACT CONCEPTS: pick a single concrete metaphor with a
  character if possible ("patience" → a child sitting cross-legged
  in front of a single sapling pushing through a crack in stone,
  expression rapt).

Output ONLY the scene description. No preamble, no quotes.`;
}

function buildPromptV2(cardFront: string, cardBack: string): string {
  return `You write visual scene descriptions for flashcard illustrations. The job is to make images so VIVID and so EXAGGERATED that the brain can't help but encode them — and through them, the card content too.

Card front: "${cardFront}"
Card back: "${cardBack}"

Write a SHORT visual scene (1-2 sentences, max 45 words).

──────────────────────────────────────────────────────────
THE MEMORABILITY TEST (the only test that matters):

Imagine a stranger glances at the finished image for two seconds,
then is asked to describe it in detail ten minutes later. Could
they? If your scene wouldn't pass that test, push it further. The
brain remembers the WEIRD, the EMOTIONAL, the OVER-THE-TOP — not
the tasteful and tidy.

If the scene wouldn't make a kid point and ask "what's THAT?",
push it further.
──────────────────────────────────────────────────────────

REQUIRED INGREDIENTS — a memorable scene needs at least TWO of
these, ideally three. Stack them:

  1. A character mid-action with a HUGE emotion. Not "happy" —
     mouth-open belly-laughing, head tipped back, knees buckling.
     Not "scared" — eyes saucer-wide, hair on end, body backflipping
     mid-air. Caricature-level. Spell out face AND body.

  2. ONE outrageous element in service of meaning. Not "weird for
     weird's sake" — weird BECAUSE it makes the meaning unforgettable:
       • impossible scale (a doctor riding a thermometer like a
         seesaw to mean "fever")
       • physical literalisation of the metaphor (a man shovelling
         stars from a cupboard, for "stargazing")
       • absurd prop (a chef wearing a colander like a crown,
         spaghetti spilling from the holes, for "Italian dinner")
     The reader should immediately get WHY the absurdity matches
     the meaning.

  3. A loud sensory anchor. Steam billowing thick, sparks
     showering, water exploding sideways, paint splattered, ONE
     screaming-bright colour against a muted scene. Things that
     make eyes lock on.

  4. Tactile, kinetic specificity. "A cat mid-pounce, every claw
     extended, fur puffed double-size" beats "a jumping cat".

──────────────────────────────────────────────────────────

STYLE TARGET (informs the downstream image model):

Picture-book illustration cranked to maximum — Quentin Blake
energy meets Pixar emotional clarity meets editorial-cartoon
exaggeration. Hand-drawn feel, bold outlines, bright but
intentional palette, dynamic composition. NEVER photoreal,
NEVER abstract, NEVER tasteful greyscale. Loud, warm,
character-led.

──────────────────────────────────────────────────────────
HARD RULES (these protect against failure modes — non-negotiable):

A. ONE focal subject. ONE person, ONE animal, or ONE object.
   Multi-subject scenes destroy FLUX's anatomy. If the card
   describes interaction ("telling a story", "having a chat"),
   one person doing it. The exaggeration goes into THAT one
   character, not into a second one.

B. Anatomically coherent under the cartoon stylisation.
   Exaggerated proportions are great. Two left feet, fused
   hands, six fingers, melted faces are not. The exaggeration
   should be deliberate, not glitchy.

C. NO TEXT. No letters, numbers, signs, labels, words, books
   showing pages of writing. The model hallucinates text
   constantly; never describe surfaces it could think need
   words.

D. Specific anchors, not generic labels. "A baseball diamond
   from behind home plate, pitcher's mound centred" — not "a
   baseball field". Wrong-sport mistakes are common; never
   leave room for them.

E. Concrete objects, not abstract words. Name physical things —
   "a clay teapot", "a wool scarf knit in red and grey", "a
   rusted brass key on a green velvet cushion". Skip
   "freedom", "loneliness", "creativity" — pick a metaphor.

──────────────────────────────────────────────────────────

CONTENT-TYPE GUIDANCE:

• IDIOMS / FIGURATIVE PHRASES:
  - Shared English visual ("take the bull by the horns") →
    depict the LITERAL imagery, dialled up. A grinning cowboy
    grappling a bull twice his size, dust flying everywhere.
  - No English equivalent ("Se me fue el santo al cielo" =
    Spanish "I lost my train of thought") → depict the
    FIGURATIVE meaning, dramatically.

• VOCABULARY WORDS: a character USING the referent with huge
  reaction. "Cup" → a wide-eyed child both-hands-clutching a
  mug as wide as their head, steam curling like a cartoon
  cloud above. NOT a still-life of a cup.

• FACTUAL QUESTIONS: depict the answer's subject with one
  unmistakable anchor + one outrageous touch. "Capital of Italy"
  → the Colosseum with a tiny gladiator on top dropping a
  pizza into the arena like a frisbee. Specific landmark =
  anchor; pizza = absurd hook = sticky.

• ABSTRACT CONCEPTS: literalise into a vivid scene with a
  character emotion. "Patience" → a tiny gardener sitting
  cross-legged with a stopwatch, staring intently at a single
  shoot of grass pushing through cracked stone.

──────────────────────────────────────────────────────────

Output ONLY the scene description. No preamble, no quotes.`;
}

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
      max_tokens: 220,
      messages: [
        {
          role: "user",
          content: buildPrompt(cardFront, cardBack),
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

Our generator deliberately produces vivid, character-led, slightly
exaggerated illustrations to maximise memorability. So:

  • Stylised proportions, expressive faces, big emotions, surreal
    juxtapositions, comedic scale — these are FEATURES, not bugs.
    Do NOT flag them.
  • What we DO want flagged: things the user would see and find
    plainly wrong or off-putting.

Flag (reply BAD) only for:
- Broken anatomy (extra limbs, merged bodies, fused hands, missing
  fingers shown clearly, warped or melted faces, eyes in wrong
  positions). Stylised cartoon hands with simplified fingers are
  FINE — only flag actual deformity.
- Wrong sport / wrong equipment / wrong context (e.g. football
  goals on a baseball field).
- Visible text, letters, numbers, or signs (image gen often
  hallucinates these).
- Multiple distinct human/animal subjects when one was implied,
  causing visual confusion.
- Subject completely unrelated to the card concept.

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

/**
 * Style preset differs per tier so Premium looks visibly more elaborate
 * than Quick, giving users a real reason to spend 5 credits instead of 1.
 *
 * Premium leans into character-led storybook illustration — expressive
 * faces, exaggerated proportions, dramatic lighting. The point is
 * MEMORABILITY: a vivid frame the brain wants to encode. Quick stays
 * deliberately plain (flat vector) so the upgrade is obvious.
 */
function wrapConceptInStyle(concept: string, tier: ImageTier): string {
  if (tier === "premium") {
    return [
      concept,
      "Storybook-illustration style with expressive characters and slightly exaggerated proportions for emotional clarity.",
      "Bold colour palette, dramatic lighting, one striking focal moment — like an arresting single frame from a story.",
      "Editorial-cartoon-meets-Pixar sensibility: warm, character-led, emotionally legible at a glance. Not photoreal, not abstract.",
      "Anatomically clean — proportions can be stylised but bodies, hands, and faces must be coherent and free of extra limbs.",
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
