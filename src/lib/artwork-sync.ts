import { readRecord } from "./device-db";
import { deviceOwner, downloadMedia } from "./device-media";
import type { LocalDeckView, LibraryManifest } from "./local-library";
import type { SavedStudy } from "./offline-study";
const running = new Map<string, Promise<void>>();
/** Public artwork does not depend on TTS preparation or a cloud auth refresh. */
export function syncSavedArtwork(owner: string): Promise<void> {
  const existing = running.get(owner); if (existing) return existing;
  const task = (async () => {
    const active = async () => navigator.onLine !== false && await deviceOwner() === owner;
    if (!await active()) return;
    const urls = new Set<string>();
    // The current daily set goes ahead of the rest of the library.
    const daily = (await readRecord<SavedStudy>(owner, "study:daily"))?.value;
    for (const card of daily?.cards ?? []) if (card.imageUrl) urls.add(card.imageUrl);
    const manifest = (await readRecord<LibraryManifest>(owner, "library:manifest"))?.value;
    for (const id of manifest?.deckIds ?? []) {
      if (!await active()) return;
      const view = (await readRecord<LocalDeckView>(owner, `query:/api/decks/${id}/view`))?.value;
      for (const card of view?.deck.cards ?? []) if (card.imageUrl) urls.add(card.imageUrl);
    }
    const pending = [...urls]; let index = 0;
    async function worker() {
      while (index < pending.length && await active()) {
        const url = pending[index++];
        if (!url) return;
        try { await downloadMedia(owner, url, false); }
        catch { /* Leave missing bytes eligible for the next automatic retry. */ }
      }
    }
    await Promise.all([worker(), worker()]);
  })().catch(() => {}).finally(() => running.delete(owner));
  running.set(owner, task); return task;
}
