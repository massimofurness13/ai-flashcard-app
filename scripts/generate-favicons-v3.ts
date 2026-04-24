/**
 * Round 3 — "F ⚡" side-by-side compositions. User wants an italic
 * serif F followed by a clear lightning bolt, like typing the emoji.
 * The prior round integrated them too aggressively. This round is
 * prompt-engineered to keep the two elements distinctly visible but
 * paired as a single mark.
 *
 * Run: npx tsx scripts/generate-favicons-v3.ts
 */

import "dotenv/config";
import { fal } from "@fal-ai/client";
import { writeFileSync } from "node:fs";

// Shared anchor — same palette/brand direction reused across every
// prompt so the outputs are comparable.
const BRAND =
  "warm honey gold color #d4a373 on deep warm black background #0f0d0a, editorial aesthetic, minimalist, iconic, flat design, 1024x1024, no text or letters except the single F, no watermarks, no borders, no drop shadows except optional subtle glow";

const VARIATIONS: Array<{ letter: string; name: string; prompt: string }> = [
  {
    letter: "A",
    name: "italic-F-bolt-beside",
    prompt: `App icon, two elements side by side with a small gap between them: an italic serif letter F on the LEFT (Fraunces-style typography, elegant, bookish), and a clean geometric lightning bolt on the RIGHT (same height as the F, zigzag shape, flat single-color fill). The F and the bolt are the SAME size and visual weight. Both elements are clearly separate and distinctly visible. ${BRAND}.`,
  },
  {
    letter: "B",
    name: "bold-F-bolt-smaller",
    prompt: `App icon, a bold italic serif capital F on the LEFT as the dominant element, and a small clean lightning bolt positioned to the RIGHT of the F as a smaller accent, the bolt about 60% the height of the F. Both elements clearly separated, not touching. Bookish, Fraunces-inspired typography. ${BRAND}.`,
  },
  {
    letter: "C",
    name: "thin-F-bold-bolt",
    prompt: `App icon, a thin elegant italic serif letter F on the LEFT paired with a bold solid-filled lightning bolt on the RIGHT. The bolt is thicker/heavier in stroke than the F. Same height. Clean visual pairing like a signature with a punctuation mark. ${BRAND}.`,
  },
  {
    letter: "D",
    name: "roman-F-angular-bolt",
    prompt: `App icon, a classical roman capital serif letter F (NOT italic, upright) on the LEFT, and a sharp angular lightning bolt on the RIGHT, both in warm honey gold. Treated like a monogram + symbol pair. Clear separation between them. Editorial book-cover aesthetic. ${BRAND}.`,
  },
  {
    letter: "E",
    name: "circle-enclosed",
    prompt: `App icon, inside a perfectly circular warm-gold outline/stroke frame: an italic serif F on the left and a lightning bolt on the right, both in matching honey gold, both at equal size, clearly separated inside the circle. Minimalist emblem style, editorial. ${BRAND}.`,
  },
  {
    letter: "F",
    name: "line-art",
    prompt: `App icon, a line-art drawing of an italic serif F on the LEFT and a lightning bolt on the RIGHT, both rendered in warm honey gold OUTLINE only (no fill, just clean single-weight strokes). Both elements same size, clearly separated. Minimalist, editorial, magazine illustration style. ${BRAND}.`,
  },
  {
    letter: "G",
    name: "retro-editorial",
    prompt: `App icon, retro editorial design: an ornate italic serif letter F with decorative terminals on the LEFT, and a stylized lightning bolt with a slight tapered tail on the RIGHT, both in warm honey gold. Old-school book-cover aesthetic, like a 1960s Penguin Classics mark. Clearly separated elements. ${BRAND}.`,
  },
  {
    letter: "H",
    name: "geometric-modern",
    prompt: `App icon, geometric modern design: a clean geometric F constructed from rectangles with serif details on the LEFT, and a geometric lightning bolt made of straight angular lines on the RIGHT, both same height, both in warm honey gold, clearly separated. Flat design, looks designed in a vector editor. ${BRAND}.`,
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
  const outPath = `/tmp/favicon-v3-${variation.letter}-${variation.name}.png`;
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
  console.log("\nAll round-3 variations written to /tmp/favicon-v3-*.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
