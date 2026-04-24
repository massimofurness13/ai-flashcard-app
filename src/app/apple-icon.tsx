import { ImageResponse } from "next/og";

// Apple-touch-icon — shown when the PWA is added to the iOS home screen
// and in older Safari tabs. Uses the same warm palette as the standard
// icon but with slightly different proportions so the F reads on the
// smaller iOS grid tile.

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
            "radial-gradient(circle at 30% 20%, rgba(212, 163, 115, 0.35), transparent 55%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 135,
            fontStyle: "italic",
            fontWeight: 500,
            color: "#d4a373",
            marginLeft: -8,
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
