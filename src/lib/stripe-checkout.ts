/**
 * Open a Stripe Checkout (or any payment-provider) URL in an external
 * browser tab. We deliberately do NOT navigate the current window —
 * that lets the app stay usable while the user pays, and sidesteps
 * Apple/Google App Store IAP rules if the app is ever wrapped in a
 * native shell.
 *
 * The `noopener,noreferrer` features prevent the new tab from holding
 * a reference back to our window.
 *
 * If the browser blocks the popup (rare for user-initiated clicks),
 * we fall back to a same-window navigation so the user still gets to
 * pay — the IAP concern is the lesser of two evils vs. a dead button.
 */
export function openStripeCheckout(url: string): void {
  if (typeof window === "undefined") return;
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Popup blocker hit. Fall back to same-window so the user still
    // gets to checkout. Keep the warning in console for ops.
    console.warn(
      "[stripe] popup blocked — falling back to same-window redirect"
    );
    window.location.href = url;
  }
}
