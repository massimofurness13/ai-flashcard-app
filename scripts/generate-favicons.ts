/**
 * One-off: generate 8 favicon direction options via FLUX dev (premium
 * tier) since we want the best quality for a brand asset. Writes the
 * results to /tmp/favicon-<letter>.png so we can inspect them in chat
 * and pick a direction.
 *
 * Run: npx tsx scripts/generate-favicons.ts
 */

import "dotenv/config";
import { fal } from "@fal-ai/client";
import { writeFileSync } from "node:fs";

const DIRECTIONS: Array<{ letter: string; name: string; prompt: string }> = [
  {
    letter: "A",
    name: "monogram-F",
    prompt:
      "Minimalist app icon, single letter F, italic serif inspired by Fraunces typeface, warm honey gold color #d4a373, deep warm black background #0f0d0a, subtle soft radial glow in the top-left corner, 1024x1024, flat design, no gradients except ambient glow, editorial, bookish, iconic, high contrast, generous clean margins, Apple iOS app icon aesthetic. No text, no letters other than the F. No watermarks, no logos, no borders, no shadows.",
  },
  {
    letter: "B",
    name: "folded-page",
    prompt:
      "App icon, stylized folded page corner motif, geometric abstraction, minimalist single-line drawing, warm honey gold linework on deep warm black background, editorial magazine aesthetic, 1024x1024, clean vector style, iconic, memorable. No text, no letters, no watermarks, no shadows, no borders.",
  },
  {
    letter: "C",
    name: "open-book",
    prompt:
      "App icon, abstract open book seen from slightly above, two facing pages, minimalist vector, warm honey gold color #d4a373 on deep warm black background #0f0d0a, single-color monogram style, 1024x1024, clean geometric forms, editorial, bookish but not cliched. No text, no letters, no watermarks, no shadows, no borders.",
  },
  {
    letter: "D",
    name: "index-card",
    prompt:
      "App icon, minimalist index card with a subtly bent top-right corner, warm honey gold outline on deep warm black background, single line weight stroke, no fill, editorial typographic style, 1024x1024, clean geometric, iconic, reminiscent of physical flashcards but abstracted. No text, no letters, no watermarks, no shadows.",
  },
  {
    letter: "E",
    name: "stacked-cards",
    prompt:
      "App icon, three stacked cards viewed from a slight angle, the top card tilted, minimalist flat design, warm honey gold color palette, deep warm black background, no drop shadows, only subtle paper-edge lines indicate depth, editorial, 1024x1024, iconic, memorable, clean vector style. No text, no letters, no watermarks, no borders.",
  },
  {
    letter: "F",
    name: "F-with-spark",
    prompt:
      "Minimalist app icon, italic serif letter F with a small five-pointed spark star floating just above the top-right terminal of the F, Fraunces-inspired typography, warm honey gold #d4a373 on deep warm black #0f0d0a, editorial aesthetic, 1024x1024, iconic monogram, flat design, no gradients except a subtle ambient glow. No other letters, no text, no watermarks, no shadows, no borders.",
  },
  {
    letter: "G",
    name: "bookmark-ribbon",
    prompt:
      "App icon, stylized bookmark ribbon motif, flat shape with a downward-pointing V notch at the bottom, warm honey gold flat color on deep warm black background, minimalist, editorial, single color, 1024x1024, iconic, clean geometric forms, magazine aesthetic. No text, no letters, no watermarks, no shadows, no borders.",
  },
  {
    letter: "H",
    name: "flash-page",
    prompt:
      "App icon, minimalist fusion of a lightning bolt and a page corner, warm honey gold linework on deep warm black background, single continuous line drawing, editorial bookish aesthetic, 1024x1024, iconic, clean vector, restrained and literary not tech-bro or overly energetic. No text, no letters, no watermarks, no shadows, no borders.",
  },
];

async function generateOne(direction: (typeof DIRECTIONS)[number]) {
  console.log(`[${direction.letter}] ${direction.name} — generating…`);
  const started = Date.now();

  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt: direction.prompt,
      image_size: "square_hd",
      num_inference_steps: 28,
      num_images: 1,
      enable_safety_checker: false,
    },
  });

  const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
  if (!url) {
    console.error(`[${direction.letter}] no image url returned`);
    return;
  }

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[${direction.letter}] download failed: ${res.status}`);
    return;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const outPath = `/tmp/favicon-${direction.letter}-${direction.name}.png`;
  writeFileSync(outPath, buffer);

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[${direction.letter}] ${direction.name} → ${outPath} (${elapsed}s)`);
}

async function main() {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    console.error("FAL_KEY not set in environment");
    process.exit(1);
  }
  fal.config({ credentials: apiKey });

  // Generate in parallel — fal.ai handles our volume fine and it's
  // much faster than sequential.
  await Promise.all(DIRECTIONS.map(generateOne));
  console.log("\nAll favicons written to /tmp/favicon-*.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
