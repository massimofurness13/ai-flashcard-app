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

// Persistent module-level <audio> element. The browser grants autoplay
// trust per-element after the first user-gesture-initiated play() —
// reusing the same element across cards means subsequent plays don't
// need a fresh gesture, which is what was breaking auto-audio in
// study sessions (each card was creating a new Audio() and losing
// the trust grant). We just swap `.src` for each new clip.
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

// Tracks the most recent set of callbacks bound to the audio element
// so cancel() can detach them cleanly when a new speak() takes over.
// `pooledAudio` is set when the active play is using a pre-decoded
// pool element rather than the shared persistent element — cancelAll
// needs that reference to pause the right thing.
let activeCallbacks: {
  ended: (() => void)[];
  error: (() => void)[];
  endedListener?: () => void;
  errorListener?: () => void;
  pooledAudio?: HTMLAudioElement | null;
} | null = null;

// ── Client-side URL cache ───────────────────────────────────────────
// Shared across the module so VoicePreloader and speak() can communicate.
// Key = `${languageCode}|${normalised text}`. Values are Supabase public
// URLs (string), never null — we don't cache misses.
const urlCache = new Map<string, string>();

// ── Decoded audio-element pool ──────────────────────────────────────
// Pre-decoded clips so a card flip doesn't have to wait for the MP3
// decode pipeline. The urlCache above eliminates the /api/tts round
// trip and warms the HTTP cache for the MP3 bytes, but the browser
// still pays a 50-150ms tax to decode MP3 → PCM the first time it
// hands those bytes to an <audio> element. That tax is what made
// the audio feel like it lagged the flip animation by a beat.
//
// Each pool entry is a real <audio> element with its `src` already
// set. Setting src triggers the browser to start downloading +
// decoding immediately (preload="auto" by default). When speak()
// later wants that URL, we play THIS element rather than swapping
// the src on the shared persistent element — the decoded buffer is
// already in memory, play() resolves on the next animation frame.
//
// Pool size capped at 8 (covers a typical "current card + next 3"
// × front/back), LRU eviction so long sessions don't grow it
// unbounded. Modern browsers handle ~50 hidden <audio> elements
// without trouble — 8 leaves enough headroom for the persistent
// element + browser internals.
const POOL_MAX = 8;
const audioPool = new Map<string, HTMLAudioElement>(); // url → audio

function poolGet(url: string): HTMLAudioElement | null {
  const entry = audioPool.get(url);
  if (!entry) return null;
  // Touch — move to the end of insertion order so LRU eviction
  // doesn't kick a clip we just used.
  audioPool.delete(url);
  audioPool.set(url, entry);
  return entry;
}

function poolPut(url: string, audio: HTMLAudioElement): void {
  audioPool.set(url, audio);
  while (audioPool.size > POOL_MAX) {
    // Map iteration is insertion order — the first key is the LRU.
    const oldest = audioPool.keys().next().value;
    if (!oldest) break;
    const evicted = audioPool.get(oldest);
    audioPool.delete(oldest);
    // Detach the element from any in-flight buffering so the browser
    // can reclaim memory immediately.
    if (evicted) {
      try {
        evicted.src = "";
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Pre-create + pre-decode an <audio> element for a URL. Cheap and
 * idempotent — if the pool already has this URL, no-op. Caller
 * doesn't need to await; the decode happens in the browser in the
 * background and the result is ready by the time speak() asks.
 */
function preloadAudioElement(url: string): void {
  if (typeof window === "undefined") return;
  if (audioPool.has(url)) return;
  try {
    const a = new Audio();
    a.preload = "auto";
    a.src = url;
    a.load(); // explicit kick so decoding starts now, not on first play
    poolPut(url, a);
  } catch {
    // Audio not supported — fall back path in playAudioUrl will
    // still work (slower, but functional).
  }
}

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

    // Warm browser HTTP cache for the MP3 bytes…
    void fetch(data.audioUrl, { mode: "cors", cache: "force-cache" }).catch(
      () => {},
    );

    // …and pre-create + pre-decode an <audio> element so the eventual
    // play() doesn't have to wait for MP3-to-PCM decode. Without this
    // the user feels a 50-150ms gap between the card flip and the
    // audio actually starting. With it, play() resolves on the next
    // animation frame.
    preloadAudioElement(data.audioUrl);
  } catch {
    // Silent — real play will retry via the on-demand path.
  }
}

// Default TTS playback speed. 1.0 is "broadcast standard" but
// Google's Neural2 / Chirp 3 HD voices have natural breath pauses
// that make 1.0 feel slow during rapid-fire study. 1.2 is the
// sweet spot — clearly faster than 1.0, still natural. Don't bump
// this any higher without a UI for it — past feedback rounds have
// confirmed 1.2 reads as "comfortable", anything more chipmunks
// the consonant-cluster languages.
const DEFAULT_TTS_SPEED = 1.2;

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
  // Pause whichever element is currently playing: the pooled one
  // (when the active play came from a pre-decoded pool element) or
  // the shared persistent element (when the pool missed).
  const target = activeCallbacks?.pooledAudio ?? persistentAudio;
  if (target) {
    target.pause();
    // We DON'T set src="" here — that destroys the element's autoplay
    // trust and forces a fresh gesture for the next play. Just pausing
    // is enough; the next play() will set a fresh src or pick a
    // different pool element and resume.
  }
  if (activeCallbacks) {
    if (target) {
      if (activeCallbacks.endedListener) {
        target.removeEventListener("ended", activeCallbacks.endedListener);
      }
      if (activeCallbacks.errorListener) {
        target.removeEventListener("error", activeCallbacks.errorListener);
      }
    }
    activeCallbacks = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

async function fetchAudioUrlOnce(
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

/**
 * Fetch the Supabase URL for a (text, languageCode) clip. Retries once
 * on transient failure with a short backoff — most /api/tts misses
 * during study sessions are intermittent (cold Render container, brief
 * Supabase blip, Google TTS hiccup) and a single retry rescues them
 * without inflicting the Web Speech fallback voice on the user.
 */
async function fetchAudioUrl(
  text: string,
  languageCode: string
): Promise<string | null> {
  const first = await fetchAudioUrlOnce(text, languageCode);
  if (first) return first;
  await new Promise((r) => setTimeout(r, 350));
  return fetchAudioUrlOnce(text, languageCode);
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

  // Detach any callbacks from the previous play and pause whatever
  // element was active.
  cancelAll();

  // Prefer a pre-decoded element from the pool — its decode pipeline
  // already ran during preload, so play() resolves on the next
  // animation frame instead of waiting for an MP3 decode. Falls back
  // to the persistent element (load + decode now) when the pool
  // misses, which is what happens for the very first card of a
  // session before the preloader has settled.
  const pooled = poolGet(url);
  const audio = pooled ?? getPersistentAudio();
  if (!pooled) {
    audio.src = url;
    audio.load();
  } else {
    // Pooled element is already loaded. Reset playhead in case it
    // was previously played (e.g. user pressed the manual speaker
    // button on the same card before flipping).
    try {
      audio.currentTime = 0;
    } catch {
      /* ignore — some browsers throw if currentTime is set before
         metadata is ready. The .play() call below still works. */
    }
  }
  audio.playbackRate = getSettings().ttsSpeed;

  const endedListener = () => callbacks.ended.forEach((cb) => cb());
  const errorListener = () => callbacks.error.forEach((cb) => cb());
  audio.addEventListener("ended", endedListener);
  audio.addEventListener("error", errorListener);

  activeCallbacks = {
    ended: callbacks.ended,
    error: callbacks.error,
    endedListener,
    errorListener,
    pooledAudio: pooled,
  };

  void audio.play().catch(() => {
    // First-ever play in a session may be blocked by autoplay policy;
    // subsequent plays succeed because the element is now trusted.
    // Either way, surface as an end so the parent's audioFinished gate
    // doesn't deadlock waiting for a clip that never started.
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
        // Decks with a language code MUST use the Google Chirp 3 HD
        // voice — the user has explicitly opted into native-speaker
        // audio. If the server can't deliver it (rate limit, network
        // blip, etc.) we silently end the clip rather than swap in
        // the robotic Web Speech voice. The countdown gate fires via
        // onError so the study session still advances normally.
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

  // No language code on the deck — legacy / hand-made cards. Web
  // Speech is the intended path here, not a fallback.
  return speakViaWebSpeech(text, options.voiceName);
}

export function stopSpeaking() {
  cancelAll();
}

export function isTTSSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window || typeof Audio !== "undefined";
}
