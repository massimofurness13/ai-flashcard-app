#!/usr/bin/env tsx
/**
 * A/B comparison of image generation providers.
 *
 * Generates the same test prompts through 3 providers and saves results
 * side by side for visual review. All providers use the same Claude
 * Haiku "visual concept" step, so differences are purely in the image model.
 *
 * Usage:
 *   set -a && source .env && set +a && npx tsx scripts/test-image-providers.ts
 *
 * Output:
 *   tests/fixtures/provider-comparison/
 *     01-bull-by-horns/
 *       stability-core.webp
 *       flux-schnell.png
 *       flux-dev.png
 *     02-... etc.
 *     _concept.txt  (the Claude-generated scene description for each)
 *     _report.md    (summary table with costs + side-by-side links)
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { fal } from "@fal-ai/client";

// --- Config ---
const OUTPUT_DIR = join(
  process.cwd(),
  "tests",
  "fixtures",
  "provider-comparison"
);

const TEST_CARDS: { slug: string; front: string; back: string }[] = [
  {
    slug: "01-bull-by-horns",
    front: "Hay que tomar el toro por los cuernos",
    back: "We have to take the bull by the horns",
  },
  {
    slug: "02-government-crisis",
    front: "El gobierno enfrenta una crisis sin precedentes",
    back: "The government faces an unprecedented crisis",
  },
  {
    slug: "03-lost-train-of-thought",
    front: "Se me fue el santo al cielo",
    back: "I completely lost my train of thought",
  },
  {
    slug: "04-wish-for-star",
    front: "¡Pide un deseo!",
    back: "Make a wish!",
  },
  {
    slug: "05-climate-change",
    front: "El cambio climático nos afecta a todos",
    back: "Climate change affects all of us",
  },
  {
    slug: "06-simple-greeting",
    front: "bonjour",
    back: "hello (French, formal)",
  },
  {
    slug: "07-vocabulary",
    front: "la mochila",
    back: "backpack (Spanish, feminine)",
  },
  {
    slug: "08-eiffel-tower",
    front: "What is the capital of France?",
    back: "Paris",
  },
  {
    slug: "09-mitochondria",
    front: "mitochondria",
    back: "the powerhouse of the cell",
  },
  {
    slug: "10-meet-at-university",
    front: "Paulina y Santiago se conocieron en la universidad.",
    back: "Paulina and Santiago met at university.",
  },
];

// --- Claude visual concept builder (mirrored from src/lib/stability-ai.ts) ---
async function buildVisualConcept(front: string, back: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `You write visual scene descriptions for educational flashcard illustrations.

Card front: "${front}"
Card back: "${back}"

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
  return block?.type === "text" ? block.text.trim() : "";
}

function wrapConceptInStyle(concept: string): string {
  return [
    concept,
    "Flat vector illustration style with soft pastel colours.",
    "Clean minimal background. Iconic, simple shapes.",
    "No text, no letters, no numbers, no writing, no signs, no labels, no words anywhere in the image.",
  ].join(" ");
}

const NEGATIVE_PROMPT =
  "text, letters, numbers, words, labels, captions, signs, writing, typography, watermark, signature, logo, blurry, low quality, realistic photo, photography";

// --- Providers ---

async function genStabilityCore(
  prompt: string
): Promise<{ bytes: Buffer; ext: string; costUsd: number }> {
  const apiKey = process.env.STABILITY_API_KEY!;
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("negative_prompt", NEGATIVE_PROMPT);
  form.append("aspect_ratio", "1:1");
  form.append("output_format", "webp");
  form.append("style_preset", "digital-art");

  const res = await fetch(
    "https://api.stability.ai/v2beta/stable-image/generate/core",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "image/*" },
      body: form,
    }
  );
  if (!res.ok) {
    throw new Error(`Stability ${res.status}: ${await res.text()}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return { bytes: Buffer.from(arrayBuffer), ext: "webp", costUsd: 0.03 };
}

async function genFluxSchnell(
  prompt: string
): Promise<{ bytes: Buffer; ext: string; costUsd: number }> {
  fal.config({ credentials: process.env.FAL_KEY });
  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt,
      image_size: "square",
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: false,
    },
  });
  // fal response shape is provider-defined
  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) throw new Error("No image URL returned from FLUX schnell");

  const imgRes = await fetch(imageUrl);
  const arrayBuffer = await imgRes.arrayBuffer();
  return { bytes: Buffer.from(arrayBuffer), ext: "png", costUsd: 0.003 };
}

async function genFluxDev(
  prompt: string
): Promise<{ bytes: Buffer; ext: string; costUsd: number }> {
  fal.config({ credentials: process.env.FAL_KEY });
  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt,
      image_size: "square",
      num_inference_steps: 28,
      num_images: 1,
      enable_safety_checker: false,
    },
  });
  // fal response shape is provider-defined
  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) throw new Error("No image URL returned from FLUX dev");

  const imgRes = await fetch(imageUrl);
  const arrayBuffer = await imgRes.arrayBuffer();
  return { bytes: Buffer.from(arrayBuffer), ext: "png", costUsd: 0.025 };
}

// --- Main ---

const ALL_PROVIDERS: {
  id: string;
  label: string;
  requiresStability?: boolean;
  gen: (prompt: string) => Promise<{ bytes: Buffer; ext: string; costUsd: number }>;
}[] = [
  { id: "stability-core", label: "Stability Core", requiresStability: true, gen: genStabilityCore },
  { id: "flux-schnell", label: "FLUX schnell (fal.ai)", gen: genFluxSchnell },
  { id: "flux-dev", label: "FLUX dev (fal.ai)", gen: genFluxDev },
];

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }
  if (!process.env.FAL_KEY) {
    console.error("FAL_KEY is not set");
    process.exit(1);
  }
  const hasStability = !!process.env.STABILITY_API_KEY;
  if (!hasStability) {
    console.log(
      "STABILITY_API_KEY not in local env — skipping Stability comparison. " +
      "You've already seen Stability's output quality. Comparing FLUX schnell vs FLUX dev."
    );
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const PROVIDERS = ALL_PROVIDERS.filter(
    (p) => !p.requiresStability || hasStability
  );

  const results: {
    slug: string;
    front: string;
    back: string;
    concept: string;
    outputs: Record<string, { path: string; costUsd: number; elapsedMs: number }>;
  }[] = [];
  const totalCost: Record<string, number> = {};

  for (const card of TEST_CARDS) {
    console.log(`\n[${card.slug}] ${card.front}`);
    const cardDir = join(OUTPUT_DIR, card.slug);
    if (!existsSync(cardDir)) mkdirSync(cardDir, { recursive: true });

    // 1. Build concept (once per card, reused across providers)
    const concept = await buildVisualConcept(card.front, card.back);
    const prompt = wrapConceptInStyle(concept);
    writeFileSync(join(cardDir, "_concept.txt"), concept + "\n\n---\n\n" + prompt);
    console.log(`  concept: ${concept.slice(0, 80)}...`);

    const outputs: Record<string, { path: string; costUsd: number; elapsedMs: number }> = {};

    // 2. Generate through each provider
    for (const provider of PROVIDERS) {
      const start = Date.now();
      try {
        const out = await provider.gen(prompt);
        const filePath = join(cardDir, `${provider.id}.${out.ext}`);
        writeFileSync(filePath, out.bytes);
        const elapsed = Date.now() - start;
        outputs[provider.id] = {
          path: filePath,
          costUsd: out.costUsd,
          elapsedMs: elapsed,
        };
        totalCost[provider.id] = (totalCost[provider.id] ?? 0) + out.costUsd;
        console.log(
          `  ✓ ${provider.label}: $${out.costUsd.toFixed(3)} in ${(elapsed / 1000).toFixed(1)}s`
        );
      } catch (err) {
        console.error(`  ✗ ${provider.label}: ${err}`);
        outputs[provider.id] = { path: "(failed)", costUsd: 0, elapsedMs: -1 };
      }
    }

    results.push({
      slug: card.slug,
      front: card.front,
      back: card.back,
      concept,
      outputs,
    });
  }

  // 3. Write summary report
  const lines: string[] = [];
  lines.push("# Image Provider Comparison\n");
  lines.push("| Provider | Total cost | Avg per image | Avg time |");
  lines.push("|---|---|---|---|");
  for (const p of PROVIDERS) {
    const cost = totalCost[p.id] ?? 0;
    const count = results.filter((r) => r.outputs[p.id]?.elapsedMs > 0).length;
    const avgTime =
      count > 0
        ? results.reduce(
            (sum, r) => sum + Math.max(r.outputs[p.id]?.elapsedMs ?? 0, 0),
            0
          ) / count / 1000
        : 0;
    lines.push(
      `| ${p.label} | $${cost.toFixed(3)} | $${(cost / Math.max(count, 1)).toFixed(4)} | ${avgTime.toFixed(1)}s |`
    );
  }
  lines.push("\n## Cards\n");
  for (const r of results) {
    lines.push(`### ${r.slug}`);
    lines.push(`**Front:** ${r.front}`);
    lines.push(`**Back:** ${r.back}`);
    lines.push(`**Concept:** ${r.concept}`);
    lines.push("");
    lines.push("| Provider | Image | Cost | Time |");
    lines.push("|---|---|---|---|");
    for (const p of PROVIDERS) {
      const out = r.outputs[p.id];
      if (!out || out.path === "(failed)") {
        lines.push(`| ${p.label} | (failed) | — | — |`);
        continue;
      }
      const relPath = out.path.replace(OUTPUT_DIR + "/", "");
      lines.push(
        `| ${p.label} | ![${p.label}](${relPath}) | $${out.costUsd.toFixed(3)} | ${(out.elapsedMs / 1000).toFixed(1)}s |`
      );
    }
    lines.push("");
  }

  writeFileSync(join(OUTPUT_DIR, "_report.md"), lines.join("\n"));
  console.log(`\n✓ Report written to ${join(OUTPUT_DIR, "_report.md")}`);
  console.log(`\nTotal costs:`);
  for (const p of PROVIDERS) {
    console.log(`  ${p.label}: $${(totalCost[p.id] ?? 0).toFixed(3)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
