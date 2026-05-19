import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Serif variants read fonts from disk → needs node runtime, not edge
export const runtime = "nodejs";

/**
 * Wordmark logo router. Renders the lightning bolt + the "Huella"
 * wordmark in the brand palette and serves the result as a PNG.
 * Save by visiting any URL and right-clicking the rendered image →
 * Save Image As.
 *
 * Serif variants use the actual Fraunces font (same family as the
 * navbar wordmark) loaded from public/fonts/ as static WOFF1 binaries
 * — Satori parses these reliably (it does NOT parse WOFF2 or
 * Fraunces' variable axes, both previous attempts):
 *
 *   /brand/logo/serif         600 weight, balanced default
 *   /brand/logo/serif-bold    700 weight, heavier strokes
 *   /brand/logo/serif-light   500 weight, more delicate
 *
 * Sans-serif variants use the platform's default font:
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

type SerifVariant = "serif" | "serif-bold" | "serif-light";
type SansVariant = "horizontal" | "stacked" | "light" | "compact";
type Variant = SerifVariant | SansVariant;

const SERIF_WEIGHTS: Record<SerifVariant, 500 | 600 | 700> = {
  serif: 600,
  "serif-bold": 700,
  "serif-light": 500,
};

function isVariant(v: string): v is Variant {
  return [
    "serif",
    "serif-bold",
    "serif-light",
    "horizontal",
    "stacked",
    "light",
    "compact",
  ].includes(v);
}

/** Read the bundled Fraunces WOFF binaries for a given weight. */
async function loadFraunces(weight: 500 | 600 | 700) {
  const dir = join(process.cwd(), "public", "fonts");
  const [roman, italic] = await Promise.all([
    readFile(join(dir, `Fraunces-${weight}.woff`)),
    readFile(join(dir, `Fraunces-${weight}-Italic.woff`)),
  ]);
  return { roman, italic };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variant: string }> }
) {
  const { variant } = await params;
  const v: Variant = isVariant(variant) ? variant : "serif";

  if (v === "serif" || v === "serif-bold" || v === "serif-light") {
    return renderSerif(v);
  }
  if (v === "horizontal") return horizontal();
  if (v === "stacked") return stacked();
  if (v === "light") return light();
  return compact();
}

async function renderSerif(v: SerifVariant) {
  const weight = SERIF_WEIGHTS[v];
  const { roman, italic } = await loadFraunces(weight);

  // Slightly different proportions per variant so each one feels
  // distinct — same horizontal layout the user liked, just different
  // weight/scale knobs.
  const fontSize = v === "serif-bold" ? 165 : v === "serif-light" ? 160 : 165;
  const boltSize = v === "serif-bold" ? 175 : v === "serif-light" ? 165 : 175;

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
          gap: "36px",
          padding: "0 64px",
          backgroundImage:
            "radial-gradient(circle at 22% 50%, rgba(212, 163, 115, 0.18), transparent 60%)",
        }}
      >
        <Bolt size={boltSize} />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: "Fraunces",
            fontSize: `${fontSize}px`,
            letterSpacing: "-0.015em",
            lineHeight: 1,
          }}
        >
          <span
            style={{
              color: "#d4a373",
              fontStyle: "italic",
              fontWeight: weight,
            }}
          >
            Hu
          </span>
          <span
            style={{
              color: "#f5f0e8",
              fontWeight: weight,
            }}
          >
            ella
          </span>
        </div>
      </div>
    ),
    {
      width: 1024,
      height: 320,
      fonts: [
        { name: "Fraunces", data: italic, style: "italic", weight },
        { name: "Fraunces", data: roman, style: "normal", weight },
      ],
    }
  );
}

// ─────────────────────────────────────────────────────────────────
// Sans-serif variants (no font load) — kept for compatibility
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
      <span style={{ color: flashColor, fontStyle: "italic" }}>Hu</span>
      <span style={{ color: mindColor }}>ella</span>
    </div>
  );
}
