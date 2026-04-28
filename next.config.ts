import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fghxwycixcawwtctknmp.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ],
};

// Sentry build-time wrapper. Uploads source maps to Sentry during
// production builds (when SENTRY_AUTH_TOKEN is present) so stack
// traces in the dashboard map back to readable source. Without the
// token, builds still succeed — Sentry just skips the upload step.
//
// org/project come from env so we don't hardcode the user's Sentry
// project identifiers in committed code. Set on Render alongside
// SENTRY_AUTH_TOKEN once the Sentry project exists.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Less noise in CI/Render build logs.
  silent: true,

  // Routes browser Sentry traffic through our domain instead of
  // sentry.io directly — sidesteps ad-block extensions that
  // otherwise drop the events.
  tunnelRoute: "/monitoring",

  // Delete generated source maps after upload to Sentry — keeps
  // them out of the public deploy. Sentry has the symbolic copy it
  // needs for stack traces; the bundle on Render doesn't.
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Disable the telemetry ping the SDK emits at build time.
  telemetry: false,
});
