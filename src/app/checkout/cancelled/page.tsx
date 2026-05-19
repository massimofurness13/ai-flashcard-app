"use client";

import { useEffect, useState } from "react";

/**
 * Mirror of /checkout/done for the cancellation path. Same close-self
 * behavior — the original app tab is still open and the user can
 * pick up where they left off.
 */
export default function CheckoutCancelledPage() {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setClosing(true);
      window.close();
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="font-editorial text-3xl font-medium">
            Checkout cancelled.
          </h1>
          <p className="text-muted-foreground">
            No charge was made. Close this tab whenever you&apos;re ready
            — your Huella tab is still where you left it.
          </p>
        </div>
        {!closing && (
          <button
            type="button"
            onClick={() => window.close()}
            className="text-sm text-primary hover:underline"
          >
            Close this tab
          </button>
        )}
      </div>
    </main>
  );
}
