import { ImageResponse } from "next/og";

// Apple touch icon — solid filled lightning bolt to match the favicon
// redesign. iOS home-screen tiles have a slightly larger safe area
// than browser favicons, so we render the bolt a touch smaller here
// (380/512 ratio at 180px = ~134px) and still get bold visibility.

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
            "radial-gradient(circle at 50% 50%, rgba(212, 163, 115, 0.32), transparent 58%)",
        }}
      >
        <svg
          width="155"
          height="155"
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
