import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Fonts are read from disk at request time — needs node runtime, not edge
export const runtime = "nodejs";

/**
 * Wordmark logo router. All variants render the lightning bolt + the
 * "FlashMind" wordmark in the brand palette and serve the result as
 * a PNG. Save by visiting the URL and right-clicking the rendered
 * image → Save Image As.
 *
 * Serif variants use the actual Fraunces TTF (same font as the navbar
 * wordmark) loaded from public/fonts/ — bytes are part of the deploy
 * so there's no fragile network fetch at request time:
 *
 *   /brand/logo/serif         600 weight, balanced default
 *   /brand/logo/serif-bold    700 weight, heavier strokes
 *   /brand/logo/serif-large   600 weight, larger bolt + canvas
 *   /brand/logo/serif-light   500 weight, more delicate
 *
 * Sans-serif variants use the platform's default font (no font load):
 *
 *   /brand/logo/horizontal    bolt | wordmark, warm dark, 1024×320
 *   /brand/logo/stacked       bolt above wordmark, square 1024×1024
 *   /brand/logo/light         cream backdrop with dark text
 *   /brand/logo/compact       tighter side-by-side, smaller bolt
 *
 * Brand palette:
 *   warm dark   #0f0d0a
 *   honey gold  #d4a373
 *   cream       #f5f0e8
 */

const BOLT_PATH = "M 60 6 L 16 52 L 40 52 L 32 94 L 84 44 L 56 44 Z";

type SerifVariant =
  | "serif"
  | "serif-bold"
  | "serif-large"
  | "serif-light";

type SansVariant = "horizontal" | "stacked" | "light" | "compact";

type Variant = SerifVariant | SansVariant;

const SERIF_VARIANTS = new Set<SerifVariant>([
  "serif",
  "serif-bold",
  "serif-large",
  "serif-light",
]);

function isVariant(v: string): v is Variant {
  return [
    "serif",
    "serif-bold",
    "serif-large",
    "serif-light",
    "horizontal",
    "stacked",
    "light",
    "compact",
  ].includes(v);
}

/** Read the Fraunces TTF binaries shipped with the deploy. */
async function loadFrauncesFromDisk() {
  const fontsDir = join(process.cwd(), "public", "fonts");
  const [roman, italic] = await Promise.all([
    readFile(join(fontsDir, "Fraunces-Variable.ttf")),
    readFile(join(fontsDir, "Fraunces-Italic-Variable.ttf")),
  ]);
  return { roman, italic };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variant: string }> }
) {
  const { variant } = await params;
  const v: Variant = isVariant(variant) ? variant : "serif";

  if (SERIF_VARIANTS.has(v as SerifVariant)) {
    return renderSerif(v as SerifVariant);
  }

  if (v === "horizontal") return horizontal();
  if (v === "stacked") return stacked();
  if (v === "light") return light();
  return compact();
}

const SERIF_CONFIGS: Record<
  SerifVariant,
  {
    weight: number;
    fontSize: number;
    boltSize: number;
    gap: number;
    padding: number;
    width: number;
    height: number;
  }
> = {
  serif: {
    weight: 600,
    fontSize: 165,
    boltSize: 175,
    gap: 36,
    padding: 64,
    width: 1024,
    height: 320,
  },
  "serif-bold": {
    weight: 700,
    fontSize: 165,
    boltSize: 175,
    gap: 36,
    padding: 64,
    width: 1024,
    height: 320,
  },
  "serif-large": {
    weight: 600,
    fontSize: 200,
    boltSize: 230,
    gap: 44,
    padding: 80,
    width: 1280,
    height: 380,
  },
  "serif-light": {
    weight: 500,
    fontSize: 160,
    boltSize: 165,
    gap: 40,
    padding: 64,
    width: 1024,
    height: 320,
  },
};

async function renderSerif(v: SerifVariant) {
  const { roman, italic } = await loadFrauncesFromDisk();
  const config = SERIF_CONFIGS[v];

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f0d0a",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: `${config.gap}px`,
          padding: `0 ${config.padding}px`,
          backgroundImage:
            "radial-gradient(circle at 22% 50%, rgba(212, 163, 115, 0.18), transparent 60%)",
        }}
      >
        <Bolt size={config.boltSize} />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: "Fraunces",
            fontSize: `${config.fontSize}px`,
            letterSpacing: "-0.015em",
            lineHeight: 1,
          }}
        >
          <span
            style={{
              color: "#d4a373",
              fontStyle: "italic",
              fontWeight: config.weight,
            }}
          >
            Flash
          </span>
          <span
            style={{
              color: "#f5f0e8",
              fontWeight: config.weight,
            }}
          >
            Mind
          </span>
        </div>
      </div>
    ),
    {
      width: config.width,
      height: config.height,
      fonts: [
        {
          name: "Fraunces",
          data: italic,
          style: "italic",
          weight: config.weight as 500 | 600 | 700,
        },
        {
          name: "Fraunces",
          data: roman,
          style: "normal",
          weight: config.weight as 500 | 600 | 700,
        },
      ],
    }
  );
}

// ─────────────────────────────────────────────────────────────────
// Sans-serif variants (no font load) — kept for backward compat
// ─────────────────────────────────────────────────────────────────

function horizontal() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f0d0a",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "40px",
          padding: "0 64px",
          backgroundImage:
            "radial-gradient(circle at 20% 50%, rgba(212, 163, 115, 0.20), transparent 60%)",
        }}
      >
        <Bolt size={170} />
        <SansWordmark fontSize={160} flashColor="#d4a373" mindColor="#f5f0e8" />
      </div>
    ),
    { width: 1024, height: 320 }
  );
}

function stacked() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f0d0a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "32px",
          padding: "48px 64px",
          backgroundImage:
            "radial-gradient(circle at 50% 35%, rgba(212, 163, 115, 0.22), transparent 65%)",
        }}
      >
        <Bolt size={260} />
        <SansWordmark fontSize={120} flashColor="#d4a373" mindColor="#f5f0e8" />
      </div>
    ),
    { width: 1024, height: 1024 }
  );
}

function light() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#faf7f2",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "40px",
          padding: "0 64px",
          backgroundImage:
            "radial-gradient(circle at 20% 50%, rgba(139, 111, 62, 0.14), transparent 60%)",
        }}
      >
        <Bolt size={170} fill="#8b6f3e" stroke="#1c1613" strokeWidth={2} />
        <SansWordmark fontSize={160} flashColor="#8b6f3e" mindColor="#1c1613" />
      </div>
    ),
    { width: 1024, height: 320 }
  );
}

function compact() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f0d0a",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          padding: "0 48px",
          backgroundImage:
            "radial-gradient(circle at 25% 50%, rgba(212, 163, 115, 0.16), transparent 55%)",
        }}
      >
        <Bolt size={130} />
        <SansWordmark fontSize={140} flashColor="#d4a373" mindColor="#f5f0e8" />
      </div>
    ),
    { width: 900, height: 240 }
  );
}

// ─────────────────────────────────────────────────────────────────
// Shared building blocks
// ─────────────────────────────────────────────────────────────────

function Bolt({
  size = 170,
  fill = "#d4a373",
  stroke = "#0f0d0a",
  strokeWidth = 2,
}: {
  size?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: "flex", flexShrink: 0 }}
    >
      <path
        d={BOLT_PATH}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SansWordmark({
  fontSize,
  flashColor,
  mindColor,
}: {
  fontSize: number;
  flashColor: string;
  mindColor: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        fontSize: `${fontSize}px`,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}
    >
      <span style={{ color: flashColor, fontStyle: "italic" }}>Flash</span>
      <span style={{ color: mindColor }}>Mind</span>
    </div>
  );
}
