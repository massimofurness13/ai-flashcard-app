/**
 * Open a Stripe Checkout (or any payment-provider) URL in an external
 * browser tab. We deliberately do NOT navigate the current window —
 * that lets the app stay usable while the user pays, and sidesteps
 * Apple/Google App Store IAP rules if the app is ever wrapped in a
 * native shell.
 *
 * Subtle bug we hit before: passing "noopener" to window.open's
 * features string forces the returned reference to null even on
 * success. We were treating null as "popup blocked" and then doing a
 * same-window redirect on TOP of the (successfully opened) new tab —
 * the user saw checkout open twice.
 *
 * Fix: open without noopener so we get a real Window reference back,
 * then defensively null its opener. If the open call returns null we
 * trust the browser actually blocked it and fall back to a
 * same-window redirect so the user still gets to pay.
 */
export function openStripeCheckout(url: string): void {
  if (typeof window === "undefined") return;
  const win = window.open(url, "_blank");
  if (win) {
    try {
      win.opener = null;
    } catch {
      // Cross-origin restrictions on opener — non-fatal.
    }
    return;
  }
  console.warn(
    "[stripe] popup blocked — falling back to same-window redirect"
  );
  window.location.href = url;
}
