"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

/**
 * Per-route error boundary. Next.js auto-uses this for any error
 * thrown inside the segments it wraps — replaces the framework's
 * default scary error page with a calm, on-brand one.
 *
 * Errors are reported to Sentry on mount so the dashboard sees
 * them even though the user has been gracefully recovered. The
 * `digest` is the server-side log correlation ID — surfacing it
 * here lets a user mention it in a support email so we can find
 * the matching log entry.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div
          className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-3xl"
          aria-hidden
        >
          ☕
        </div>
        <div className="space-y-2">
          <p className="label-caps">Something broke</p>
          <h1 className="font-editorial text-3xl font-medium sm:text-4xl">
            We hit a snag.
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            This page failed to load. Your data is safe — we&apos;ve
            reported the issue automatically. Try again, or head back
            home and try a different route.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center h-10 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 rounded-md border border-border px-5 text-sm font-medium hover:border-primary/40 transition-colors"
          >
            Back to home
          </Link>
        </div>
        {error.digest && (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
