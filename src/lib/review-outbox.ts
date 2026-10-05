import { deleteRecord, listRecords, writeRecord } from "@/lib/device-db";
import { deviceOwner } from "@/lib/device-media";

export interface PendingReview { eventId: string; cardId: string; quality: number; reviewedAt: string; error?: string }
const flushing = new Map<string, Promise<void>>();
const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("huella:outbox")); };
export async function queueReview(cardId: string, quality: number): Promise<void> {
  const owner = await deviceOwner();
  if (!owner) throw new Error("Sign in to save your review.");
  const review: PendingReview = { eventId: crypto.randomUUID(), cardId, quality, reviewedAt: new Date().toISOString() };
  await writeRecord(owner, `review:${review.eventId}`, review);
  notify();
  void flushReviews(owner);
}
export async function flushReviews(owner: string): Promise<void> {
  const existing = flushing.get(owner);
  if (existing) return existing;
  const task = (async () => {
    try {
      while (await deviceOwner() === owner) {
        const items = (await listRecords(owner, "review:")).filter(record => !(record.value as PendingReview).error);
        items.sort((a, b) => a.savedAt - b.savedAt);
        const item = items[0];
        if (!item) break;
        const response = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.value), signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
          if ([400, 404, 409].includes(response.status)) {
            const data = await response.json().catch(() => ({}));
            await writeRecord(owner, item.key, { ...(item.value as PendingReview), error: data.error || "Review needs attention." });
            continue;
          }
          break;
        }
        await deleteRecord(owner, item.key);
        notify();
        window.dispatchEvent(new Event("huella:data-changed"));
      }
    } catch { /* Keep every unacknowledged event for a later retry. */ }
    finally { notify(); }
  })().finally(() => flushing.delete(owner));
  flushing.set(owner, task);
  return task;
}
