"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight success page Stripe redirects to after checkout. The
 * tab was opened with window.open from the original app tab, which
 * means the browser allows us to call window.close() programmatically.
 * We try once, and if the close doesn't take (some browsers refuse
 * after a navigation chain), the message stays visible for the user
 * to dismiss manually.
 *
 * Why not redirect back into the app: that creates a duplicate tab —
 * the original app tab is still open. Better UX is to confirm
 * success here, close, and let the original tab refresh on focus.
 */
export default function CheckoutDonePage() {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Tiny delay so the user actually sees the confirmation before
    // the tab vanishes — instant close feels jarring and like the
    // payment didn't register.
    const t = setTimeout(() => {
      setClosing(true);
      window.close();
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="font-editorial text-3xl font-medium">
            Payment received.
          </h1>
          <p className="text-muted-foreground">
            Your credits are being added now. You can close this tab and
            head back to Huella — the new balance will be there
            waiting.
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
