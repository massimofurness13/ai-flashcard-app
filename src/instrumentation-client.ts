import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side Sentry init. Next.js auto-loads this file on every
 * page (it's the App Router replacement for sentry.client.config.ts).
 *
 * Disabled in dev to keep the local console quiet and avoid burning
 * quota on every typo. In production, every uncaught exception in
 * the browser — including React render errors that escape error
 * boundaries — gets reported.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // No performance sampling at launch — keeps free-tier event budget
  // for actual errors, not transactions.
  tracesSampleRate: 0,

  // Replay would be lovely but isn't on the free tier. Off for now.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  enabled: process.env.NODE_ENV === "production",
});

// Required for Next.js App Router navigation tracing — even with
// tracesSampleRate=0, this hook needs to exist so the SDK can wire
// up the router instrumentation cleanly.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
