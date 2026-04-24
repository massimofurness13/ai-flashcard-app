import { ImageResponse } from "next/og";

// App icon — hand-traced clone of the line-art lightning bolt from
// round-3 option F. Pure vector: thin warm-gold outline stroke on warm
// near-black with an ambient glow. Crisp at every size (16×16 favicon
// through 512×512 app icon) because it's strokes, not a rasterised
// generation with AI-upscale blur.
//
// Path geometry:
//   (62,12)  top point (slightly right of centre)
//   ↓ diagonal down-left
//   (24,56)  middle-left notch
//   → short horizontal step
//   (44,56)  inner notch
//   ↓ diagonal down-left again
//   (28,88)  bottom point (slightly left of centre)
//   ↗ diagonal up-right — the "bounce"
//   (70,44)  middle-right notch
//   ← short horizontal step
//   (50,44)  inner notch
//   Z        close back to top
// All in a 100×100 viewBox; stroke width of 2.5 gives the same thin
// neon feel as the FLUX reference without any rasterisation artefacts.

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          // Soft warm glow behind the bolt — gives the same atmospheric
          // depth the FLUX reference had without needing SVG filters
          // (Satori doesn't support feGaussianBlur).
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(212, 163, 115, 0.28), transparent 55%)",
        }}
      >
        <svg
          width="360"
          height="360"
          viewBox="0 0 100 100"
          style={{ display: "flex" }}
        >
          <path
            d="M 62 12 L 24 56 L 44 56 L 28 88 L 70 44 L 50 44 Z"
            fill="none"
            stroke="#d4a373"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size
  );
}
