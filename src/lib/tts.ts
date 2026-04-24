/**
 * Client TTS entry points. Primary path is the server API (`/api/tts`)
 * which returns a cached Supabase MP3 URL from Google Cloud TTS.
 * Web Speech API is kept as a last-resort fallback for:
 *   - decks without a language code set (legacy / hand-made cards)
 *   - offline / API errors
 *   - unsupported languages
 *
 * ── Latency architecture ───────────────────────────────────────────
 * A cold play goes through three hops: /api/tts → Supabase Storage →
 * audio decode. Together that's ~500-900ms after the user taps play.
 * Two tiers of caching shave that down to near-zero when the voice
 * preloader has had a chance to run:
 *
 *   1. `urlCache` (this file) — module-level Map from (text+language)
 *      to the Supabase public URL. Preloader populates it; speak()
 *      reads it synchronously, skipping the /api/tts round trip.
 *
 *   2. Browser HTTP cache — preloader also fetches the MP3 bytes from
 *      the Supabase URL, warming the browser's native cache. When the
 *      Audio element later loads the same URL, it's an instant cache
 *      hit (no CDN round trip, no decode delay).
 *
 * Net result: cards whose voice was preloaded start playing in ~50ms
 * after the card mounts. Cards whose voice wasn't preloaded (first
 * card of a session before the preloader settles) still go through
 * the full network path.
 */

export interface SpeakHandle {
  /** Stop playback immediately. Safe to call multiple times. */
  cancel: () => void;
  /** Fires when playback finishes naturally. */
  onEnded?: (cb: () => void) => void;
  /** Fires if the API or audio element errors. */
  onError?: (cb: () => void) => void;
}

// Keep a singleton audio element so a new speak() cancels the previous one.
let currentAudio: HTMLAudioElement | null = null;

// ── Client-side URL cache ───────────────────────────────────────────
// Shared across the module so VoicePreloader and speak() can communicate.
// Key = `${languageCode}|${normalised text}`. Values are Supabase public
// URLs (string), never null — we don't cache misses.
const urlCache = new Map<string, string>();

function cacheKey(text: string, languageCode: string): string {
  return `${languageCode}|${text.trim().toLowerCase()}`;
}

/** Synchronously read a preloaded URL. Returns null if not cached. */
export function getCachedAudioUrl(
  text: string,
  languageCode: string
): string | null {
  return urlCache.get(cacheKey(text, languageCode)) ?? null;
}

/**
 * Preload the audio for a (text, language) pair. Two-step:
 *   1. POST /api/tts to get the Supabase public URL, cache it.
 *   2. GET the URL itself so the MP3 bytes land in the browser's
 *      HTTP cache, making the eventual <audio> fetch instant.
 *
 * Fire-and-forget — exceptions are swallowed because a failed preload
 * falls back to the on-demand path in speak() with no user-visible
 * regression.
 */
export async function preloadAudio(
  text: string,
  languageCode: string
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

    // Warm browser HTTP cache. fetch() without reading the body still
    // causes the browser to store the response — same mechanism <audio>
    // would use, minus the decode step. The Supabase public bucket
    // serves CORS headers so this works cross-origin.
    void fetch(data.audioUrl, { mode: "cors", cache: "force-cache" }).catch(
      () => {}
    );
  } catch {
    // Silent — real play will retry via the on-demand path.
  }
}

function getSettings(): { ttsSpeed: number } {
  try {
    const saved = localStorage.getItem("flashmind-settings");
    if (saved) {
      const s = JSON.parse(saved);
      return { ttsSpeed: s.ttsSpeed || 1 };
    }
  } catch {
    /* ignore */
  }
  return { ttsSpeed: 1 };
}

function cancelAll() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

async function fetchAudioUrl(
  text: string,
  languageCode: string
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

function speakViaWebSpeech(
  text: string,
  voiceName?: string | null
): SpeakHandle {
  const callbacks: { ended: (() => void)[]; error: (() => void)[] } = {
    ended: [],
    error: [],
  };

  if (typeof window === "undefined" || !window.speechSynthesis) {
    return {
      cancel: () => {},
      onEnded: (cb) => callbacks.ended.push(cb),
      onError: (cb) => callbacks.error.push(cb),
    };
  }

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = getSettings().ttsSpeed;
  if (voiceName) {
    const match = window.speechSynthesis.getVoices().find((v) => v.name === voiceName);
    if (match) utter.voice = match;
  }
  utter.onend = () => callbacks.ended.forEach((cb) => cb());
  utter.onerror = () => callbacks.error.forEach((cb) => cb());

  cancelAll();
  window.speechSynthesis.speak(utter);

  return {
    cancel: () => window.speechSynthesis.cancel(),
    onEnded: (cb) => callbacks.ended.push(cb),
    onError: (cb) => callbacks.error.push(cb),
  };
}

function playAudioUrl(url: string): SpeakHandle {
  const callbacks: { ended: (() => void)[]; error: (() => void)[] } = {
    ended: [],
    error: [],
  };

  cancelAll();
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.playbackRate = getSettings().ttsSpeed;
  audio.addEventListener("ended", () => callbacks.ended.forEach((cb) => cb()));
  audio.addEventListener("error", () => callbacks.error.forEach((cb) => cb()));

  currentAudio = audio;
  void audio.play().catch(() => {
    // Autoplay may be blocked until user gesture — a silent fail is fine,
    // the manual voice button will succeed on click.
    callbacks.error.forEach((cb) => cb());
  });

  return {
    cancel: () => {
      audio.pause();
      audio.src = "";
      if (currentAudio === audio) currentAudio = null;
    },
    onEnded: (cb) => callbacks.ended.push(cb),
    onError: (cb) => callbacks.error.push(cb),
  };
}

/**
 * Speak `text`. When `languageCode` is set, uses the server TTS API
 * (cached native-speaker voice). Otherwise falls back to browser
 * Web Speech with optional voiceName override.
 *
 * Fast path: if the preloader already ran and we have a cached URL,
 * we skip the /api/tts round trip entirely and play synchronously.
 * This is what makes card-to-audio feel instant during study sessions.
 */
export function speak(
  text: string,
  options: {
    languageCode?: string | null;
    voiceName?: string | null;
  } = {}
): SpeakHandle {
  if (!text || !text.trim()) {
    return { cancel: () => {} };
  }

  if (options.languageCode) {
    // Fast path — synchronous cache hit from preloader.
    const cached = getCachedAudioUrl(text, options.languageCode);
    if (cached) {
      return playAudioUrl(cached);
    }

    // Slow path — async fetch. Wire up a handle that gets filled in
    // once the fetch returns.
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
      const url = await fetchAudioUrl(text, options.languageCode!);
      if (!url) {
        // Fall back to Web Speech with the voice hint if available.
        const inner = speakViaWebSpeech(text, options.voiceName);
        handle.cancel = inner.cancel;
        inner.onEnded?.(() => endedCbs.forEach((cb) => cb()));
        inner.onError?.(() => errorCbs.forEach((cb) => cb()));
        return;
      }
      const inner = playAudioUrl(url);
      handle.cancel = inner.cancel;
      inner.onEnded?.(() => endedCbs.forEach((cb) => cb()));
      inner.onError?.(() => errorCbs.forEach((cb) => cb()));
    })();

    return handle;
  }

  return speakViaWebSpeech(text, options.voiceName);
}

export function stopSpeaking() {
  cancelAll();
}

export function isTTSSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window || typeof Audio !== "undefined";
}
