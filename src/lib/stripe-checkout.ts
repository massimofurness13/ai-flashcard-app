/**
 * Open a Stripe Checkout (or any payment-provider) URL in an
 * external browser tab — *without* falling into the popup-blocker
 * trap that bit us when users reported "I click Upgrade and nothing
 * happens".
 *
 * The trap (production bug, May 2026):
 *   `await fetch(...)` then `window.open(url, "_blank")` =
 *   the browser no longer considers `window.open` to be inside the
 *   user-gesture context. Strict popup blockers (Chrome default for
 *   some users, Safari, Firefox enhanced tracking) return a stub
 *   non-null Window reference that never paints, or return null.
 *   Either way the user clicked, nothing visible happened, and our
 *   silent fallback (`if (win) ... else redirect`) failed to fire
 *   because we got a "successful" stub.
 *
 * Fix pattern (every upgrade button in the app uses this):
 *   1. SYNCHRONOUSLY inside the click handler, call
 *      `prepareStripeCheckout()`. This opens `about:blank` while
 *      the browser still considers us inside the user gesture,
 *      so the popup blocker lets it through.
 *   2. Do your async work (fetch the Stripe URL).
 *   3. On success, call `openStripeCheckout(url, prepared)` — we
 *      just navigate the prepared window to the real URL.
 *   4. On failure (no URL, exception), call `prepared?.close()` to
 *      dismiss the empty tab.
 *
 * If `prepareStripeCheckout()` itself was blocked (very aggressive
 * popup blocker, or programmatic invocation outside a user gesture),
 * `openStripeCheckout` falls back to a same-window redirect so the
 * user can still pay. The "external tab" intent (App Store IAP
 * sidestep if we ever wrap in Capacitor) is preserved in the common
 * case while degrading gracefully when it isn't possible.
 */

export type PreparedCheckout = Window | null;

/**
 * Open a placeholder tab synchronously inside a click handler. Hold
 * the returned reference until your async work finishes, then either
 * navigate it (success) or close it (failure).
 */
export function prepareStripeCheckout(): PreparedCheckout {
  if (typeof window === "undefined") return null;
  try {
    return window.open("about:blank", "_blank");
  } catch {
    return null;
  }
}

/**
 * Navigate a pre-opened tab to the checkout URL. If no tab was
 * pre-opened (or it was blocked), tries a fresh window.open and
 * falls back to a same-window redirect.
 */
export function openStripeCheckout(
  url: string,
  prepared?: PreparedCheckout,
): void {
  if (typeof window === "undefined") return;

  // Happy path — the caller opened a blank tab synchronously
  // inside their click handler. We just point it at the URL.
  if (prepared) {
    try {
      prepared.location.href = url;
      return;
    } catch {
      // Cross-origin lock or window already closed by user — fall
      // through to the no-prepared path.
    }
  }

  // No prepared window. Try a fresh open (might work if a click
  // handler called us directly without the prepare step).
  let win: Window | null = null;
  try {
    win = window.open(url, "_blank");
  } catch {
    win = null;
  }
  if (win) {
    try {
      win.opener = null;
    } catch {
      // Cross-origin restriction on opener — non-fatal.
    }
    return;
  }

  console.warn(
    "[stripe] popup blocked — falling back to same-window redirect",
  );
  window.location.href = url;
}
