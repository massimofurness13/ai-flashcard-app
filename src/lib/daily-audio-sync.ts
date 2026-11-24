import { readRecord, writeRecord } from "./device-db";
import { requestAudioRecording } from "./audio-request";
import { audioKey, currentMediaGeneration, deviceOwner, downloadMedia, resolveSavedAudio, validMediaUrl } from "./device-media";
import { fallbackVoiceCodes } from "./language-codes";
import type { LibraryManifest } from "./local-library";
import type { SavedStudy } from "./offline-study";
import { toLocalDateKey } from "./timezone";

interface DailyAudioOptions {
  /** Saved-account mode can still download public URLs without preparing new audio. */
  canPrepare?: () => boolean;
}

const running = new Map<string, Promise<void>>();

/** Save only today's already-selected cards. Never select cards or change study progress. */
export function syncDailyAudio(owner: string, options: DailyAudioOptions = {}): Promise<void> {
  const existing = running.get(owner);
  if (existing) return existing;
  const task = (async () => {
    const generation = currentMediaGeneration();
    let stopped = false;
    let preparationBlocked = false;
    let timeZone = "UTC";
    let day: string | undefined = undefined;
    const today = () => toLocalDateKey(new Date(), timeZone);
    const online = () => typeof navigator !== "undefined" && navigator.onLine !== false;
    const active = async () => {
      if (!owner || stopped || generation !== currentMediaGeneration() || !online()) return false;
      const currentOwner = await deviceOwner();
      if (currentOwner !== owner) stopped = true;
      return !stopped && generation === currentMediaGeneration() && online() && (!day || day === today());
    };
    if (!await active()) return;
    const saved = (await readRecord<SavedStudy>(owner, "study:daily"))?.value;
    if (!saved?.daily || !Array.isArray(saved.cards)) return;
    const manifest = (await readRecord<LibraryManifest>(owner, "library:manifest"))?.value;
    timeZone = manifest?.timeZone || "UTC";
    try { today(); } catch { timeZone = "UTC"; }
    day = saved.daily.day;
    if (!await active()) return;

    const fallback = fallbackVoiceCodes(saved.learningLanguage);
    const clips = new Map<string, { text: string; language: string }>();
    for (const card of saved.cards) {
      for (const [text, language] of [
        [card.front, card.deck.frontLanguageCode || fallback.front],
        [card.back, card.deck.backLanguageCode || fallback.back],
      ]) {
        if (text?.trim() && language) {
          const clip = { text: text.trim(), language };
          clips.set(audioKey(clip.text, language), clip);
        }
      }
    }
    const pending = [...clips.values()];
    let index = 0;
    async function worker() {
      while (await active()) {
        const clip = pending[index++];
        if (!clip) return;
        try {
          let url = await resolveSavedAudio(owner, clip.text, clip.language);
          if (!await active()) return;
          if (!url) {
            if (preparationBlocked || options.canPrepare?.() === false) continue;
            // One clip per request, never a pack/library preparation on navigation.
            const response = await requestAudioRecording(clip.text, clip.language);
            if ([401, 403, 429].includes(response.status)) preparationBlocked = true;
            if (response.status < 200 || response.status >= 300 ||
                !response.audioUrl || !validMediaUrl(response.audioUrl)) continue;
            if (!await active()) return;
            url = response.audioUrl;
            await writeRecord(owner, audioKey(clip.text, clip.language), url);
          }
          if (!await active()) return;
          // Metadata/bytes on disk are the checkpoint; a URL alone is not completion.
          // device-media also cancels in-flight writes at account boundaries.
          await downloadMedia(owner, url, false, true);
        } catch (error) {
          if (error instanceof Error && error.name === "QuotaExceededError") stopped = true;
          // Keep successful clips; retry missing bytes on the next automatic pass.
        }
      }
    }
    await Promise.all([worker(), worker()]);
  })().catch(() => {
    // Storage can be unavailable temporarily. Never interrupt the study screen.
  }).finally(() => running.delete(owner));
  running.set(owner, task);
  return task;
}

/** Coalesce wake-ups; media writes must never trigger their own download pass. */
export function startDailyAudioSync(owner: string, options: DailyAudioOptions = {}) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const kick = () => {
    if (stopped || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!stopped) void syncDailyAudio(owner, options);
    }, 1000);
  };
  const visible = () => { if (document.visibilityState === "visible") kick(); };
  const saved = (event: Event) => {
    const detail = (event as CustomEvent<{ owner?: string; key?: string; url?: string }>).detail;
    if (detail?.owner && detail.owner !== owner) return;
    if (!detail || detail.key === "study:daily" || detail.url === "study:daily" || detail.key === "library:manifest" ||
        detail.url === "/api/library" || (detail.url?.startsWith("/api/review?") &&
          new URLSearchParams(detail.url.split("?")[1]).get("filter") === "daily")) kick();
  };
  // Selection writes do not all emit an event, so also discover new plans periodically.
  const interval = setInterval(visible, 60000);
  window.addEventListener("online", kick);
  window.addEventListener("huella:device-saved", saved);
  document.addEventListener("visibilitychange", visible);
  kick();
  return {
    kick,
    stop() {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", kick);
      window.removeEventListener("huella:device-saved", saved);
      document.removeEventListener("visibilitychange", visible);
      // An existing pass may finish across navigation; each write still checks its owner.
    },
  };
}
