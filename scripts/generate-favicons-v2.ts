/**
 * F + lightning-bolt variations. User picked the lightning bolt from
 * round 1 (H) but wants it paired with an F. Exploring six composition
 * options so we can pick the best layout before vectorising.
 *
 * Run: npx tsx scripts/generate-favicons-v2.ts
 */

import "dotenv/config";
import { fal } from "@fal-ai/client";
import { writeFileSync } from "node:fs";

// Anchor the bolt style: the exact lightning from option H — warm
// honey gold, soft glow halo, angled downward from upper-right to
// lower-left, clean geometric. We paste this description into each
// variation so FLUX keeps the same bolt character.
const BOLT_STYLE =
  "the lightning bolt is a clean geometric shape, warm honey gold color #d4a373, with a subtle soft glow halo around it, no 3D shading, flat vector-style";

const VARIATIONS: Array<{ letter: string; name: string; prompt: string }> = [
  {
    letter: "1",
    name: "bolt-replaces-crossbar",
    prompt: `Minimalist app icon, single letter F in italic serif typography inspired by Fraunces typeface, warm honey gold color #d4a373 on deep warm black background #0f0d0a. Instead of a straight horizontal crossbar, the F uses a small lightning bolt as its crossbar — ${BOLT_STYLE}. The rest of the F is a clean serif. Editorial, bookish, 1024x1024, iconic, centred, generous margins, flat design. No other text, no letters besides the F, no watermarks, no shadows, no borders.`,
  },
  {
    letter: "2",
    name: "bolt-through-F",
    prompt: `Minimalist app icon, single letter F in elegant italic serif typography, warm honey gold color #d4a373 on deep warm black background #0f0d0a. A lightning bolt slashes diagonally through the middle of the F from upper-right to lower-left — ${BOLT_STYLE}. The F remains fully readable behind the bolt. Editorial, bookish, 1024x1024, iconic monogram, centred, flat design. No other text, no letters besides the F, no watermarks, no shadows, no borders.`,
  },
  {
    letter: "3",
    name: "bolt-beside-F",
    prompt: `Minimalist app icon, single italic serif letter F in warm honey gold color #d4a373 on deep warm black background #0f0d0a, and a small lightning bolt positioned just above and to the right of the F's top terminal — ${BOLT_STYLE}. The F is the dominant element, the bolt is a small accent. Editorial Fraunces-inspired typography, bookish, 1024x1024, iconic, flat design, generous clean margins. No other text, no letters besides the F, no watermarks, no shadows, no borders.`,
  },
  {
    letter: "4",
    name: "bolt-as-stem",
    prompt: `Minimalist app icon, stylised F where the vertical stem of the F IS a lightning bolt — the vertical stroke of the F zigzags like a lightning bolt instead of being straight. Warm honey gold #d4a373 on deep warm black #0f0d0a. ${BOLT_STYLE}. The two horizontal arms of the F branch off the zigzag stem cleanly. Editorial, iconic, 1024x1024, flat geometric design. No other text, no letters, no watermarks, no shadows, no borders.`,
  },
  {
    letter: "5",
    name: "F-dot-bolt",
    prompt: `Minimalist app icon on deep warm black background #0f0d0a. An italic serif letter F in warm honey gold #d4a373 inspired by Fraunces typography, with a small lightning bolt positioned exactly where the tittle would sit above a lowercase i — directly above the top-right area of the F, acting as a decorative accent mark. ${BOLT_STYLE}. Editorial, bookish, 1024x1024, iconic, flat design, Apple iOS app icon aesthetic, clean generous margins. No other letters besides the F, no text, no watermarks, no shadows, no borders.`,
  },
  {
    letter: "6",
    name: "bolt-F-composed",
    prompt: `Minimalist app icon, a single letter F composed ENTIRELY of lightning bolt geometry — the F silhouette made from zigzag lightning-bolt lines instead of straight serif strokes. Warm honey gold #d4a373 on deep warm black #0f0d0a. ${BOLT_STYLE}. Reads clearly as the letter F but with electric zigzag energy. Editorial meets electric, 1024x1024, iconic, flat geometric design. No other text, no letters, no watermarks, no shadows, no borders.`,
  },
];

async function generateOne(variation: (typeof VARIATIONS)[number]) {
  console.log(`[${variation.letter}] ${variation.name} — generating…`);
  const started = Date.now();

  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt: variation.prompt,
      image_size: "square_hd",
      num_inference_steps: 28,
      num_images: 1,
      enable_safety_checker: false,
    },
  });

  const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
  if (!url) {
    console.error(`[${variation.letter}] no image url returned`);
    return;
  }

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[${variation.letter}] download failed: ${res.status}`);
    return;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const outPath = `/tmp/favicon-v2-${variation.letter}-${variation.name}.png`;
  writeFileSync(outPath, buffer);

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[${variation.letter}] ${variation.name} → ${outPath} (${elapsed}s)`);
}

async function main() {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    console.error("FAL_KEY not set in environment");
    process.exit(1);
  }
  fal.config({ credentials: apiKey });

  await Promise.all(VARIATIONS.map(generateOne));
  console.log("\nAll variations written to /tmp/favicon-v2-*.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
