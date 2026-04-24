import type { MetadataRoute } from "next";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";

// PWA manifest. Generated at build time so it stays in sync with
// globals.css — when we shift the palette again, this follows. The
// `icons` array is intentionally empty: Next.js 16 picks up
// src/app/icon.tsx and src/app/apple-icon.tsx and wires them into the
// HTML head as <link rel="icon"> and <link rel="apple-touch-icon">,
// which most PWA install flows pick up as a fallback. We can add
// explicit icon entries back here when we ship a final logo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#0f0d0a",
    theme_color: "#0f0d0a",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
