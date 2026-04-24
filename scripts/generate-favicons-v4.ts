/**
 * Round 4 — line-art outline F + line-art outline lightning bolt,
 * side by side. User loved round-3 option F (thin neon-outline bolt)
 * but noted we keep dropping the F. Structuring the prompts so the
 * F is described FIRST and most prominently before the bolt; FLUX
 * has been latching onto "lightning" and ignoring the letter.
 *
 * Run: npx tsx scripts/generate-favicons-v4.ts
 */

import "dotenv/config";
import { fal } from "@fal-ai/client";
import { writeFileSync } from "node:fs";

// Common style anchor — thin warm-gold outline, no fill, neon-like
// glow. Matches the aesthetic of round-3 option F exactly.
const OUTLINE_STYLE =
  "rendered as thin OUTLINE strokes only (no fill, just clean single-weight lines), warm honey gold color #d4a373 with a very subtle glow halo, deep warm black background #0f0d0a, minimalist, flat design, 1024x1024, iconic, editorial aesthetic, no watermarks, no borders";

const VARIATIONS: Array<{ letter: string; name: string; prompt: string }> = [
  {
    letter: "A",
    name: "outline-F-first-then-bolt",
    prompt: `App icon with EXACTLY TWO symbols arranged side-by-side like typed characters, separated by a small gap, both at the SAME SIZE and SAME HEIGHT. LEFT SYMBOL: a classical capital letter F with serifs — an uppercase sans-serif-ish F with two horizontal arms and a vertical stem. RIGHT SYMBOL: a lightning bolt, zigzag shape. BOTH symbols are drawn in identical thin-line outline style — thin warm honey gold strokes, no interior fill. Think of it like the text "F⚡" typed in a single-weight outline font. ${OUTLINE_STYLE}.`,
  },
  {
    letter: "B",
    name: "outline-italic-F-bolt",
    prompt: `App icon: two distinct symbols side by side. FIRST SYMBOL on the left: an italic lowercase letter f in serif typography, drawn as a thin warm gold outline with no fill — only the stroke of the letter is visible. SECOND SYMBOL on the right: a lightning bolt, zigzag shape, also drawn as a thin warm gold outline with no fill. The two symbols are SEPARATE with clear space between them, both the same height. Reads like "f ⚡" written in outline strokes. ${OUTLINE_STYLE}.`,
  },
  {
    letter: "C",
    name: "neon-F-bolt-pair",
    prompt: `App icon, neon-sign aesthetic: the uppercase letter F drawn as a glowing thin warm-gold neon tube outline on the left, and a lightning bolt drawn as the same style of glowing thin warm-gold neon tube outline on the right. Both symbols clearly separated, both the same size and height, both in identical neon line-stroke style. Warm honey gold glow on deep warm black background. Simple and iconic. Think: a retro neon sign with just "F" and a bolt. ${OUTLINE_STYLE}.`,
  },
  {
    letter: "D",
    name: "wireframe-F-and-bolt",
    prompt: `App icon showing TWO separate wireframe symbols side by side: on the LEFT, a capital F drawn purely as thin warm-gold line segments — the F has a vertical stem and two horizontal arms at the top and middle. On the RIGHT with a gap between them, a lightning bolt drawn purely as thin warm-gold line segments — the bolt has a zigzag diagonal shape. No shading, no fill, no gradients — only the outlined strokes of each symbol are visible. Both symbols have equal visual weight. ${OUTLINE_STYLE}.`,
  },
  {
    letter: "E",
    name: "hand-drawn-F-bolt",
    prompt: `App icon, hand-drawn sketch style: a capital letter F drawn in a single continuous thin warm-gold line, positioned on the left side. To the right of the F, with a small gap between them, a lightning bolt drawn in the exact same single continuous thin warm-gold line style. Both symbols are line drawings with no fill, the F and the bolt are equally prominent, like a quick confident sketch of the two symbols side by side. ${OUTLINE_STYLE}.`,
  },
  {
    letter: "F",
    name: "monoline-F-bolt",
    prompt: `App icon, monoline design with exactly two elements: (1) the capital letter F on the left, drawn as single-weight warm-gold outline strokes without fill, and (2) a lightning bolt to the right of the F with a small gap between them, drawn in the exact same single-weight warm-gold outline style without fill. Both elements are the same height, same stroke weight, clearly visible as two separate symbols. Do NOT merge or overlap them. ${OUTLINE_STYLE}.`,
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
  const outPath = `/tmp/favicon-v4-${variation.letter}-${variation.name}.png`;
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
  console.log("\nAll round-4 variations written to /tmp/favicon-v4-*.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
