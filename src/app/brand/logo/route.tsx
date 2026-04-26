import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Wordmark logo for upload to Stripe / external integrations / press kit.
 *
 *   <bolt> Flash Mind
 *
 * Same palette as the favicon (warm near-black + honey gold) and same
 * editorial typography signature as the navbar (italic "Flash" in gold,
 * roman "Mind" in cream). Sized 1024×320 — wide enough to read at the
 * sizes Stripe shows it (header banners, receipt headers, hosted
 * checkout chrome).
 *
 * Save the PNG by visiting /brand/logo and right-click → Save Image.
 */
export async function GET() {
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
          gap: "32px",
          padding: "0 56px",
          // Subtle warm halo around the bolt — matches the icon's
          // ambient glow so the brand feels consistent across surfaces.
          backgroundImage:
            "radial-gradient(circle at 20% 50%, rgba(212, 163, 115, 0.18), transparent 60%)",
        }}
      >
        {/* Bolt — same path as src/app/icon.tsx, sized to match the
         * x-height of the wordmark for visual balance. */}
        <svg
          width="160"
          height="160"
          viewBox="0 0 100 100"
          style={{ display: "flex", flexShrink: 0 }}
        >
          <path
            d="M 60 6 L 16 52 L 40 52 L 32 94 L 84 44 L 56 44 Z"
            fill="#d4a373"
            stroke="#0f0d0a"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>

        {/* Wordmark — italic gold "Flash" + roman cream "Mind".
         * Note: ImageResponse uses a default sans-serif at the edge;
         * we'd need to ship a font file to render Fraunces here. The
         * default still reads well at this size and keeps the build
         * lean. If you want true Fraunces, swap to a fetched font. */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: "152px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#d4a373", fontStyle: "italic" }}>Flash</span>
          <span style={{ color: "#f5f0e8" }}>Mind</span>
        </div>
      </div>
    ),
    { width: 1024, height: 320 }
  );
}
