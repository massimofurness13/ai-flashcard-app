"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort error boundary — catches errors thrown in the root
 * layout itself (the only place src/app/error.tsx can't reach
 * because the layout owns the surrounding <html> and <body>).
 *
 * Standalone HTML and inline styles on purpose: if the layout's
 * fonts, theme provider, or globals.css are what failed, we can't
 * rely on any of them rendering. Plain inline CSS ensures the user
 * always sees something readable, even when everything else is
 * broken.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          backgroundColor: "#0f0d0a",
          color: "#f5f0e8",
        }}
      >
        <div
          style={{
            maxWidth: "28rem",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "3rem",
              marginBottom: "1rem",
            }}
            aria-hidden
          >
            ☕
          </div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 500,
              margin: "0 0 0.75rem",
            }}
          >
            We hit a serious snag.
          </h1>
          <p
            style={{
              color: "#bbb1a0",
              lineHeight: 1.6,
              margin: "0 0 1.5rem",
            }}
          >
            Huella crashed. Your data is safe — we&apos;ve reported
            the issue. Please reload the page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#0f0d0a",
              backgroundColor: "#d4a373",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: "1.5rem",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#7a7166",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
