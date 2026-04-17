import { generateAndUploadFromPrompt } from "@/lib/stability-ai";

export interface ImageGenerationResult {
  imageUrl: string;
  isPlaceholder: boolean;
}

export interface ImageGenerator {
  generate(prompt: string, userId?: string): Promise<ImageGenerationResult>;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

class PlaceholderImageGenerator implements ImageGenerator {
  async generate(prompt: string): Promise<ImageGenerationResult> {
    const hash = simpleHash(prompt);
    const hue1 = hash % 360;
    const hue2 = (hash * 7) % 360;
    const initials = prompt
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue1},70%,60%)"/>
          <stop offset="100%" style="stop-color:hsl(${hue2},70%,40%)"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#g)" rx="12"/>
      <text x="200" y="160" text-anchor="middle" font-size="64" font-family="system-ui" fill="white" opacity="0.6">${initials}</text>
    </svg>`;

    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

    return { imageUrl: dataUrl, isPlaceholder: true };
  }
}

class StabilityAIImageGenerator implements ImageGenerator {
  async generate(prompt: string, userId?: string): Promise<ImageGenerationResult> {
    const uid = userId || "anonymous";
    const imageUrl = await generateAndUploadFromPrompt(uid, prompt);
    return { imageUrl, isPlaceholder: false };
  }
}

/**
 * Returns the best available image generator.
 * Uses Stability AI if STABILITY_API_KEY is set, otherwise falls back to placeholder SVGs.
 */
function createImageGenerator(): ImageGenerator {
  if (process.env.STABILITY_API_KEY) {
    return new StabilityAIImageGenerator();
  }
  return new PlaceholderImageGenerator();
}

export const imageGenerator: ImageGenerator = createImageGenerator();
