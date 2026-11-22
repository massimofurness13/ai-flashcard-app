import { readRecord } from "./device-db";
import { deviceOwner } from "./device-media";
import { selectLocalStudy, type LibraryManifest } from "./local-library";
import { readOfflineStudy, saveStudy, studyKey, type SavedStudy } from "./offline-study";
import { withQueryDeadline } from "./query-deadline";
import { toLocalDateKey } from "./timezone";

/** Opening cards must not wait for a pack-by-pack migration or queued uploads. */
export function loadStudySession(owner: string, params: URLSearchParams, options: { signal?: AbortSignal; now?: Date; timeoutMs?: number } = {}) {
  return withQueryDeadline(async signal => {
    const assertActive = async () => {
      signal.throwIfAborted();
      if (await deviceOwner() !== owner) throw new Error("Your account changed. Please reopen Study.");
      signal.throwIfAborted();
    };
    await assertActive();
    const key = studyKey(params), filter = params.get("filter") || "due";
    const saved = await readOfflineStudy(owner, key);
    const manifest = (await readRecord<LibraryManifest>(owner, "library:manifest"))?.value;
    let today: string;
    try { today = toLocalDateKey(options.now ?? new Date(), manifest?.timeZone || "UTC"); }
    catch { today = toLocalDateKey(options.now ?? new Date(), "UTC"); }
    // An already prepared daily set is authoritative for this device. Never
    // rebuild it (or replace its checkpoint) because a background sync is slow.
    if (saved && (filter === "daily" ? saved.data.daily?.day === today : saved.snapshot && saved.snapshot.currentIndex < saved.snapshot.cards.length)) {
      await assertActive(); return saved;
    }
    let localError: unknown;
    try {
      const local = await selectLocalStudy(owner, params, options.now ?? new Date(), { hydrateHistory: false, signal });
      if (local) {
        await assertActive();
        await saveStudy(owner, key, local);
        await assertActive();
        return { data: local, snapshot: null };
      }
    } catch (error) {
      signal.throwIfAborted();
      localError = error;
    }
    if (saved && filter !== "daily") { await assertActive(); return saved; }
    if (navigator.onLine === false) {
      if (localError instanceof Error) throw localError;
      throw new Error("Connect once to finish saving your library. Your existing reviews are safe.");
    }
    // One canonical selection is safer and faster than downloading every pack's
    // history on the opening screen. The normal background sync repairs packs.
    const response = await fetch(`/api/review?${params}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? "Sign in to sync this account, then try again. Your saved reviews are safe."
      : "Couldn’t load your daily set yet. Please try again.");
    const data: SavedStudy = await response.json();
    if (!Array.isArray(data.cards) || (filter === "daily" && (!data.daily || data.daily.day !== today))) throw new Error("The daily set isn’t ready yet. Please try again.");
    await assertActive();
    await saveStudy(owner, key, data);
    await assertActive();
    return { data, snapshot: null };
  }, options.timeoutMs ?? 20000, options.signal);
}

export function studyLoadError(error: unknown): string {
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError" || /^(Cancelled|Refresh timed out)$/i.test(error.message))) {
    return "Opening took too long. Please try again—your saved cards and progress are still here.";
  }
  return error instanceof Error ? error.message : "Couldn’t open your cards yet. Please try again.";
}
