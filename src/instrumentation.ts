/**
 * Server-side instrumentation. Next.js calls `register` once per
 * server instance startup, before any requests are served. We use
 * it to bootstrap Sentry on whichever runtime the request is using
 * (Node.js or Edge — both initialised by the same SDK call here).
 *
 * Why inline init instead of separate sentry.{server,edge}.config
 * files: Turbopack's bundler refuses to resolve relative dynamic
 * imports from instrumentation.ts cleanly. Inlining sidesteps the
 * resolver entirely and the @sentry/nextjs SDK auto-detects the
 * runtime, so a single init() works for both Node and Edge.
 */
import * as Sentry from "@sentry/nextjs";

export function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    enabled: process.env.NODE_ENV === "production",
  });
}

// Surfaces React Server Component errors to Sentry. Without this
// hook, RSC errors get swallowed by the framework and never reach
// the dashboard.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
