/**
 * Client TTS. The ONLY voice path is the server API (`/api/tts`)
 * which returns a cached Supabase MP3 URL produced by Google Cloud
 * TTS (native-speaker Chirp 3 HD voices).
 *
 * We deliberately do NOT use the browser's Web Speech API as a
 * fallback anymore. Product decision (user feedback): the robotic
 * device voice is never acceptable. If a clip can't be produced via
 * Google (no language code, network failure), we stay SILENT and
 * fire the "ended" signal so the study countdown still advances —
 * a missing clip is better than a jarring synthetic one.
 *
 * ── Autoplay trust (the reason for the single persistent element) ──
 * Browsers grant autoplay permission per-<audio>-element after that
 * element has been play()'d inside a user gesture once. A study
 * session auto-plays each card's audio from a useEffect — NOT a
 * gesture — so it only works if we reuse the SAME element that
 * earned trust from the first tap. Creating a fresh Audio() per
 * clip (or a pool of them) loses that trust and the browser
 * silently blocks auto-play. We learned this twice: once with the
 * per-card `new Audio()`, and again with a short-lived pre-decode
 * pool. Hence: exactly one module-level element, src swapped per
 * clip.
 *
 * ── Latency ────────────────────────────────────────────────────────
 * The VoicePreloader warms two caches for upcoming clips:
 *   1. urlCache — (text+lang) → Supabase URL, so speak() skips the
 *      /api/tts round trip.
 *   2. Browser HTTP cache — the MP3 bytes, so the <audio> element's
 *      fetch is instant. Only the MP3→PCM decode remains (~30-80ms),
 *      which is the unavoidable tax of the single-element approach.
 */

export interface SpeakHandle {
  /** Stop playback immediately. Safe to call multiple times. */
  cancel: () => void;
  /** Fires when playback finishes naturally (or is skipped). */
  onEnded?: (cb: () => void) => void;
  /** Fires if the API or audio element errors. */
  onError?: (cb: () => void) => void;
}

// Single persistent module-level <audio> element. See the autoplay
// note in the file header — this is load-bearing, do not replace
// with per-clip elements or a pool.
let persistentAudio: HTMLAudioElement | null = null;
function getPersistentAudio(): HTMLAudioElement {
  if (typeof window === "undefined") {
    throw new Error("getPersistentAudio called on server");
  }
  if (!persistentAudio) {
    persistentAudio = new Audio();
    persistentAudio.preload = "auto";
  }
  return persistentAudio;
}

// Tracks the callbacks bound to the audio element so cancel() can
// detach them cleanly when a new speak() takes over.
let activeCallbacks: {
  ended: (() => void)[];
  error: (() => void)[];
  endedListener?: () => void;
  errorListener?: () => void;
} | null = null;

// ── Client-side URL cache ───────────────────────────────────────────
// (text+lang) → Supabase public URL. Preloader populates it; speak()
// reads it synchronously to skip the /api/tts round trip.
const urlCache = new Map<string, string>();

function cacheKey(text: string, languageCode: string): string {
  return `${languageCode}|${text.trim().toLowerCase()}`;
}

/** Synchronously read a preloaded URL. Returns null if not cached. */
export function getCachedAudioUrl(
  text: string,
  languageCode: string,
): string | null {
  return urlCache.get(cacheKey(text, languageCode)) ?? null;
}

/**
 * Preload the audio for a (text, language) pair:
 *   1. POST /api/tts to get the Supabase URL, cache it.
 *   2. GET the URL so the MP3 bytes land in the browser HTTP cache,
 *      making the eventual <audio> fetch instant.
 *
 * Fire-and-forget — exceptions are swallowed; a failed preload just
 * falls back to the on-demand path in speak().
 *
 * NOTE: we intentionally do NOT pre-create <audio> elements here.
 * That was tried (a pre-decode pool) and broke autoplay — see the
 * file header. Warming the HTTP cache is the safe optimisation.
 */
export async function preloadAudio(
  text: string,
  languageCode: string,
): Promise<void> {
  if (!text || !text.trim() || !languageCode) return;
  const key = cacheKey(text, languageCode);
  if (urlCache.has(key)) return;

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { audioUrl?: string };
    if (!data.audioUrl) return;

    urlCache.set(key, data.audioUrl);

    void fetch(data.audioUrl, { mode: "cors", cache: "force-cache" }).catch(
      () => {},
    );
  } catch {
    // Silent — real play will retry via the on-demand path.
  }
}

// Default TTS playback speed. 1.0 = broadcast standard, matches the
// account-page slider default. Per-user override (ttsSpeed in
// localStorage "huella-settings") wins over this.
const DEFAULT_TTS_SPEED = 1.0;

function getSettings(): { ttsSpeed: number } {
  try {
    const saved = localStorage.getItem("huella-settings");
    if (saved) {
      const s = JSON.parse(saved);
      return { ttsSpeed: s.ttsSpeed || DEFAULT_TTS_SPEED };
    }
  } catch {
    /* ignore */
  }
  return { ttsSpeed: DEFAULT_TTS_SPEED };
}

function cancelAll() {
  if (persistentAudio) {
    persistentAudio.pause();
    // Don't set src="" — that destroys the element's autoplay trust
    // and forces a fresh gesture for the next play. Pausing is enough.
  }
  if (activeCallbacks) {
    if (persistentAudio) {
      if (activeCallbacks.endedListener) {
        persistentAudio.removeEventListener(
          "ended",
          activeCallbacks.endedListener,
        );
      }
      if (activeCallbacks.errorListener) {
        persistentAudio.removeEventListener(
          "error",
          activeCallbacks.errorListener,
        );
      }
    }
    activeCallbacks = null;
  }
}

async function fetchAudioUrlOnce(
  text: string,
  languageCode: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { audioUrl?: string };
    if (data.audioUrl) {
      urlCache.set(cacheKey(text, languageCode), data.audioUrl);
    }
    return data.audioUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the Supabase URL for a clip. Retries once on transient
 * failure (cold Render container, brief Supabase blip, Google TTS
 * hiccup) before giving up and going silent.
 */
async function fetchAudioUrl(
  text: string,
  languageCode: string,
): Promise<string | null> {
  const first = await fetchAudioUrlOnce(text, languageCode);
  if (first) return first;
  await new Promise((r) => setTimeout(r, 350));
  return fetchAudioUrlOnce(text, languageCode);
}

function playAudioUrl(url: string): SpeakHandle {
  const callbacks: { ended: (() => void)[]; error: (() => void)[] } = {
    ended: [],
    error: [],
  };

  cancelAll();
  const audio = getPersistentAudio();
  audio.src = url;
  audio.playbackRate = getSettings().ttsSpeed;
  // Explicit load() so the new src buffers immediately even if the
  // previous play was paused mid-stream. The MP3 bytes are usually
  // warm in the HTTP cache (preloader), so this is just the decode.
  audio.load();

  const endedListener = () => callbacks.ended.forEach((cb) => cb());
  const errorListener = () => callbacks.error.forEach((cb) => cb());
  audio.addEventListener("ended", endedListener);
  audio.addEventListener("error", errorListener);

  activeCallbacks = {
    ended: callbacks.ended,
    error: callbacks.error,
    endedListener,
    errorListener,
  };

  void audio.play().catch(() => {
    // First play of a session may be blocked by autoplay policy
    // until the element earns trust from a gesture; subsequent plays
    // on the same element succeed. Surface as an end so the parent's
    // audioFinished gate doesn't deadlock.
    callbacks.error.forEach((cb) => cb());
  });

  return {
    cancel: () => {
      audio.pause();
      audio.removeEventListener("ended", endedListener);
      audio.removeEventListener("error", errorListener);
      if (activeCallbacks?.endedListener === endedListener) {
        activeCallbacks = null;
      }
    },
    onEnded: (cb) => callbacks.ended.push(cb),
    onError: (cb) => callbacks.error.push(cb),
  };
}

/**
 * A no-op handle that fires its onEnded on the next microtask. Used
 * when there's no language code to speak with — we stay silent
 * (never the device voice) but still tell the study session "audio
 * is done" so the auto-flip / auto-advance countdown proceeds.
 */
function silentHandle(): SpeakHandle {
  const endedCbs: (() => void)[] = [];
  // Defer so the caller has registered its onEnded callback by the
  // time we fire (the caller does handle.onEnded(...) synchronously
  // right after we return).
  setTimeout(() => endedCbs.forEach((cb) => cb()), 0);
  return {
    cancel: () => {},
    onEnded: (cb) => endedCbs.push(cb),
    onError: () => {},
  };
}

/**
 * Speak `text` in the given language using the cached native-speaker
 * Google voice. `languageCode` may be null/empty — in that case we
 * stay silent (never the browser device voice). Callers that want a
 * fallback (e.g. the study session falling back to the user's
 * learning language) should resolve that fallback BEFORE calling and
 * pass the resolved code as `languageCode`.
 *
 * `voiceName` is accepted for call-site compatibility but no longer
 * used — voice is fully determined by the language code on the server.
 */
export function speak(
  text: string,
  options: {
    languageCode?: string | null;
    voiceName?: string | null;
  } = {},
): SpeakHandle {
  if (!text || !text.trim()) {
    return { cancel: () => {} };
  }

  const languageCode = options.languageCode;
  if (!languageCode) {
    // No language → silent. We never fall back to Web Speech.
    return silentHandle();
  }

  // Fast path — synchronous cache hit from the preloader.
  const cached = getCachedAudioUrl(text, languageCode);
  if (cached) {
    return playAudioUrl(cached);
  }

  // Slow path — async fetch, then play. Wire a handle that fills in
  // once the URL resolves.
  const handle: SpeakHandle = {
    cancel: () => cancelAll(),
    onEnded: undefined,
    onError: undefined,
  };
  const endedCbs: (() => void)[] = [];
  const errorCbs: (() => void)[] = [];
  handle.onEnded = (cb) => endedCbs.push(cb);
  handle.onError = (cb) => errorCbs.push(cb);

  (async () => {
    const url = await fetchAudioUrl(text, languageCode);
    if (!url) {
      // Couldn't produce the Google clip. Stay silent, fire onError
      // so the countdown still advances.
      errorCbs.forEach((cb) => cb());
      return;
    }
    const inner = playAudioUrl(url);
    handle.cancel = inner.cancel;
    inner.onEnded?.(() => endedCbs.forEach((cb) => cb()));
    inner.onError?.(() => errorCbs.forEach((cb) => cb()));
  })();

  return handle;
}

export function stopSpeaking() {
  cancelAll();
}

export function isTTSSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof Audio !== "undefined";
}
