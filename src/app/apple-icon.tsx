import { ImageResponse } from "next/og";

// Apple touch icon — same line-art lightning bolt as icon.tsx, sized
// at 180×180 for the iOS home-screen tile. Proportions nudged slightly
// so the bolt feels anchored at smaller size (iOS tiles have larger
// padding than favicons).

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(212, 163, 115, 0.28), transparent 55%)",
        }}
      >
        <svg
          width="130"
          height="130"
          viewBox="0 0 100 100"
          style={{ display: "flex" }}
        >
          <path
            d="M 62 12 L 24 56 L 44 56 L 28 88 L 70 44 L 50 44 Z"
            fill="none"
            stroke="#d4a373"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size
  );
}
