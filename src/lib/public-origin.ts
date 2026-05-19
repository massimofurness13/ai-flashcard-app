/**
 * Resolve the user-facing origin for redirect URLs (Stripe success/
 * cancel, OAuth callbacks, etc.).
 *
 * Why this exists: on Render, `request.url` reflects the internal
 * proxy address (`http://localhost:10000`) — not the public hostname
 * the user's browser is on. Building Stripe redirect URLs from
 * `new URL(request.url).origin` therefore sends users to a dead
 * `localhost` page after checkout. This helper picks the right
 * origin in priority order:
 *
 *   1. NEXT_PUBLIC_APP_URL — if set, this is the source of truth
 *      (e.g. https://huella-35q4.onrender.com or your custom
 *      domain once you point one). Trim trailing slashes.
 *   2. X-Forwarded-Proto + X-Forwarded-Host — what Render sends so
 *      apps behind its proxy can know the public origin.
 *   3. request.url — last resort. Works locally; broken on Render.
 */
export function getPublicOrigin(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host");
  if (proto && host) return `${proto}://${host}`;

  return new URL(request.url).origin;
}
