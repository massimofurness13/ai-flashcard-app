export const IMAGE_PROGRESS_IDLE_MS = 10 * 60 * 1000;

/** Keep an explicitly started job visible while images are arriving. */
export function progressExpiry(previousPending: number, pending: number, expiresAt: number, now: number): number {
  return pending < previousPending && pending > 0 ? now + IMAGE_PROGRESS_IDLE_MS : expiresAt;
}
