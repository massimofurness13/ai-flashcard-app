import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Wordmark logo router. Visit any of:
 *   /brand/logo/horizontal   — bolt + wordmark side-by-side, warm dark bg
 *   /brand/logo/stacked      — bolt above wordmark, warm dark bg, square-ish
 *   /brand/logo/light        — same as horizontal but cream background
 *                              (use on dark surfaces / dark-mode contexts)
 *   /brand/logo/compact      — tight side-by-side, smaller bolt
 *
 * Each variant returns a PNG suitable for upload to Stripe / press kits.
 * Save by right-clicking the rendered image → Save Image As.
 *
 * All variants share the brand palette:
 *   warm dark   #0f0d0a
 *   honey gold  #d4a373
 *   cream       #f5f0e8
 *   sage glow   #a3b08a (used for ambient halo)
 */

const BOLT_PATH = "M 60 6 L 16 52 L 40 52 L 32 94 L 84 44 L 56 44 Z";

type Variant = "horizontal" | "stacked" | "light" | "compact";

function isVariant(v: string): v is Variant {
  return ["horizontal", "stacked", "light", "compact"].includes(v);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variant: string }> }
) {
  const { variant } = await params;
  const v: Variant = isVariant(variant) ? variant : "horizontal";

  if (v === "stacked") return stacked();
  if (v === "light") return light();
  if (v === "compact") return compact();
  return horizontal();
}

/** Variant 1: bolt + wordmark side-by-side, warm dark backdrop. */
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
        <Wordmark fontSize={160} flashColor="#d4a373" mindColor="#f5f0e8" />
      </div>
    ),
    { width: 1024, height: 320 }
  );
}

/** Variant 2: bolt centred above wordmark — works as a square-ish app icon. */
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
        <Wordmark fontSize={120} flashColor="#d4a373" mindColor="#f5f0e8" />
      </div>
    ),
    { width: 1024, height: 1024 }
  );
}

/** Variant 3: cream backdrop, dark wordmark + dark-outlined bolt.
 *  Use this on dark surfaces where you need an inverted brand mark. */
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
        <Wordmark fontSize={160} flashColor="#8b6f3e" mindColor="#1c1613" />
      </div>
    ),
    { width: 1024, height: 320 }
  );
}

/** Variant 4: tighter side-by-side, smaller bolt.
 *  Reads better at small sizes (favicon-adjacent contexts). */
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
        <Wordmark fontSize={140} flashColor="#d4a373" mindColor="#f5f0e8" />
      </div>
    ),
    { width: 900, height: 240 }
  );
}

/** Lightning bolt — same path as src/app/icon.tsx. */
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

/** Italic gold "Flash" + roman cream "Mind" — the signature wordmark. */
function Wordmark({
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
