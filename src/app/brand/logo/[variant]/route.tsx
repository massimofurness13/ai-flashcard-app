import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Wordmark logo router. All variants use the editorial Fraunces serif
 * (same font as the navbar wordmark) on the warm-dark backdrop, with
 * the lightning bolt on the left and italic-gold "Flash" + roman-cream
 * "Mind" on the right. Variants differ in weight + scale only:
 *
 *   /brand/logo/serif         600 weight, balanced default (Stripe upload)
 *   /brand/logo/serif-bold    700 weight, heavier strokes
 *   /brand/logo/serif-large   600 weight, larger bolt + text
 *   /brand/logo/serif-light   500 weight, more delicate
 *
 * Also kept for backward compat:
 *   /brand/logo/horizontal    sans-serif fallback (no font fetch)
 *   /brand/logo/stacked       bolt above wordmark, square 1024×1024
 *   /brand/logo/light         cream backdrop, dark text
 *   /brand/logo/compact       sans-serif compact, smaller bolt
 *
 * Save by visiting any URL and right-clicking the image → Save Image As.
 *
 * Brand palette:
 *   warm dark   #0f0d0a
 *   honey gold  #d4a373
 *   cream       #f5f0e8
 */

const BOLT_PATH = "M 60 6 L 16 52 L 40 52 L 32 94 L 84 44 L 56 44 Z";

type Variant =
  | "serif"
  | "serif-bold"
  | "serif-large"
  | "serif-light"
  | "horizontal"
  | "stacked"
  | "light"
  | "compact";

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

/**
 * Pull the Fraunces font binary from Google Fonts at request time.
 * We hit the css2 API, parse the first url(...) from the response,
 * then fetch the actual font file. We pass a User-Agent string that
 * Google's CDN responds to with a TTF (rather than the default woff2)
 * because Satori — the engine ImageResponse uses internally — has
 * the broadest format support for TTF.
 */
async function loadFraunces(
  weight: number,
  italic: boolean
): Promise<ArrayBuffer> {
  const ital = italic ? "1," : "0,";
  const cssUrl = `https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@${ital}${weight}&display=swap`;
  const css = await fetch(cssUrl, {
    headers: {
      // A non-modern UA forces Google to serve a TTF/woff link rather
      // than woff2, which Satori may not parse reliably.
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64; rv:60.0) Gecko/20100101 Firefox/60.0",
    },
  }).then((r) => r.text());

  const match = css.match(/src:\s*url\(([^)]+)\)/);
  if (!match) {
    throw new Error("Could not extract Fraunces font URL from Google CSS");
  }
  const fontData = await fetch(match[1]).then((r) => r.arrayBuffer());
  return fontData;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variant: string }> }
) {
  const { variant } = await params;
  const v: Variant = isVariant(variant) ? variant : "serif";

  // Sans-serif legacy variants — no font fetch needed
  if (v === "horizontal") return horizontal();
  if (v === "stacked") return stacked();
  if (v === "light") return light();
  if (v === "compact") return compact();

  // Serif variants — fetch Fraunces in italic + roman at the chosen weight
  const config = SERIF_CONFIGS[v];
  const [italicFont, romanFont] = await Promise.all([
    loadFraunces(config.weight, true),
    loadFraunces(config.weight, false),
  ]);

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
        { name: "Fraunces", data: italicFont, style: "italic", weight: config.weight as 400 | 500 | 600 | 700 },
        { name: "Fraunces", data: romanFont, style: "normal", weight: config.weight as 400 | 500 | 600 | 700 },
      ],
    }
  );
}

/** Per-variant tuning for the serif logos. */
const SERIF_CONFIGS = {
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
} as const;

// ─────────────────────────────────────────────────────────────────
// Sans-serif legacy variants (no font fetch)
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

/** Sans-serif wordmark used by the legacy variants. */
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
