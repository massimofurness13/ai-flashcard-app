import { deleteRecord, listRecords, writeRecord, writeRecords } from "@/lib/device-db";
import { flushLocalPlans } from "./offline-plans";
import { deviceOwner } from "@/lib/device-media";

export interface PendingReview { eventId: string; cardId: string; quality: number; direction?: "front" | "back"; reviewedAt: string; error?: string; operation?: "undo"; sequence?: number }
let enqueueChain: Promise<void> = Promise.resolve();
export type ReviewCheckpoint = (review: PendingReview) => { key: string; value: unknown };
function enqueue(owner: string, key: string, review: PendingReview, checkpoint?: ReviewCheckpoint) {
  const task = enqueueChain.then(async () => {
    const pending = await listRecords(owner, "review:");
    const sequence = Math.max(Date.now(), ...pending.map(r => (r.value as PendingReview).sequence ?? r.savedAt)) + 1;
    await writeRecords(owner, [{key, value: {...review,sequence}}, {key:`local-${key}`,value:{...review,sequence}}, ...(checkpoint ? [checkpoint(review)] : [])]);
  });
  enqueueChain = task.catch(() => {});
  return task;
}
const flushing = new Map<string, Promise<void>>();
const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("huella:outbox")); };
export async function queueReview(cardId: string, quality: number, direction?: "front" | "back", checkpoint?: ReviewCheckpoint): Promise<PendingReview> {
  const owner = await deviceOwner();
  if (!owner) throw new Error("Sign in to save your review.");
  const review: PendingReview = { eventId: crypto.randomUUID(), cardId, quality, ...(direction ? {direction} : {}), reviewedAt: new Date().toISOString() };
  await enqueue(owner, `review:${review.eventId}`, review, checkpoint);
  notify();
  void flushReviews(owner);
  return review;
}

export async function queueUndo(review: PendingReview, checkpoint?: ReviewCheckpoint): Promise<void> {
  const owner = await deviceOwner();
  if (!owner) throw new Error("Sign in to undo your review.");
  await enqueue(owner, `review:undo:${review.eventId}`, {...review, operation:"undo"}, checkpoint);
  notify();
  void flushReviews(owner);
}
export async function flushReviews(owner: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const existing = flushing.get(owner);
  if (existing) return existing;
  const task = (async () => {
    let acknowledged = false;
    try {
      await flushLocalPlans(owner);
      while (await deviceOwner() === owner) {
        const pending = await listRecords(owner, "review:");
        const blockedCards = new Set(pending.filter(r => (r.value as PendingReview).operation === "undo" && (r.value as PendingReview).error).map(r => (r.value as PendingReview).cardId));
        const items = pending.filter(record => !(record.value as PendingReview).error && !blockedCards.has((record.value as PendingReview).cardId));
        items.sort((a, b) => ((a.value as PendingReview).sequence ?? a.savedAt) - ((b.value as PendingReview).sequence ?? b.savedAt));
        const item = items[0];
        if (!item) break;
        const response = await fetch("/api/review", { method: (item.value as PendingReview).operation === "undo" ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.value), redirect: "error", signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
          if ([400, 404, 409].includes(response.status)) {
            const data = await response.json().catch(() => ({}));
            await writeRecord(owner, item.key, { ...(item.value as PendingReview), error: data.error || "Review needs attention." });
            continue;
          }
          break;
        }
        // HTTP 200 alone is not proof of a saved review: an auth proxy or
        // captive portal may have served HTML instead. Keep the durable
        // event until the review API explicitly acknowledges it.
        if (response.redirected) break;
        const acknowledgement = await response.json();
        if (acknowledgement?.recorded !== true) break;
        await deleteRecord(owner, item.key);
        acknowledged = true;
        notify();
      }
    } catch { /* Keep every unacknowledged event for a later retry. */ }
    finally {
      notify();
      // Refresh remote pages once after the batch, not once per uploaded card.
      // The outbox event already updates local progress during the upload.
      if (acknowledged) window.dispatchEvent(new Event("huella:data-changed"));
    }
  })().finally(() => flushing.delete(owner));
  flushing.set(owner, task);
  return task;
}
