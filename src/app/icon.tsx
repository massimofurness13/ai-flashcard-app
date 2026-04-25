import { ImageResponse } from "next/og";

// App icon — bold solid lightning bolt that survives 16×16 favicon
// rendering. The previous version was a thin outline stroke at 2.5
// units in a 100-unit viewBox, which downscales to roughly 0.4 px at
// favicon size — invisible. This version uses a FILLED bolt sized
// almost edge-to-edge, so even at favicon scale it reads as a clear
// silhouette.
//
// Path geometry (filled, 100×100 viewBox, padded ~6 units from each
// edge so the shape never touches the rounded corners):
//   (60, 6)   top-right starting point
//   ↓ steep diagonal to the middle-left notch
//   (16, 52)
//   →
//   (40, 52)
//   ↓ second diagonal segment to the bottom point
//   (32, 94)
//   ↗ "bounce" back up to the middle-right notch
//   (84, 44)
//   ←
//   (56, 44)
//   close back up to the top
// The result is a chunky bolt, no inner negative space — exactly what
// shows clearly at 16×16. A 2-unit dark stroke around the perimeter
// keeps the silhouette crisp against light backgrounds (dark mode tab
// vs. light mode tab — the warm near-black ring works on both).

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
          // Soft warm halo behind the bolt — gives the icon depth
          // without fighting the silhouette at small sizes.
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(212, 163, 115, 0.32), transparent 58%)",
        }}
      >
        <svg
          width="460"
          height="460"
          viewBox="0 0 100 100"
          style={{ display: "flex" }}
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
      </div>
    ),
    size
  );
}
