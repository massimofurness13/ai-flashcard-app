import { ImageResponse } from "next/og";

// App icon (favicon + PWA). Generated dynamically by Next.js at build
// time via ImageResponse — no raster asset to ship or regenerate when
// the palette shifts. Palette sourced directly from globals.css dark
// theme so it stays in sync as the brand evolves.

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
          // A subtle inner glow echoes the home page's ambient gradient
          // so the icon shares the same atmospheric quality as the app.
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(212, 163, 115, 0.35), transparent 55%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 380,
            fontStyle: "italic",
            fontWeight: 500,
            color: "#d4a373",
            // Slight offset so the stroke of the F anchors visually;
            // italic serifs read centred when they're nudged left.
            marginLeft: -24,
            lineHeight: 1,
          }}
        >
          F
        </div>
      </div>
    ),
    size
  );
}
