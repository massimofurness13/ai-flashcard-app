/** Google TTS recordings are saved on the device. Upcoming clips are decoded
 * into a bounded PCM cache and share one unlocked AudioContext, so normal-speed
 * flips schedule sound without reloading a media element. The single trusted
 * HTML element remains the compatibility/pitch-preserving speed fallback.
 * Missing audio is an error, never a successful recording for study timers.
 */

import { audioKey, deviceOwner, downloadMedia, resolveSavedAudio, savedMedia } from "@/lib/device-media";
import { writeRecord } from "@/lib/device-db";
import { requestAudioRecording } from "./audio-request";
import { getAppActivity, subscribeAppActivity } from "./app-activity";
import { clearPreparedAudio, ensurePreparedAudioRunning, isAudioPrepared, prepareAudioBuffer, playPreparedAudio, recoverPreparedAudio, unlockPreparedAudio } from "./prepared-audio";

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

// A tiny silent WAV, generated once and cached. Built in JS (rather
// than a hand-typed base64 string) so it's guaranteed to be a valid
// file every browser will accept. Used only by unlockAudio().
let silentUnlockUrl: string | null = null;
function getSilentUnlockUrl(): string {
  if (silentUnlockUrl) return silentUnlockUrl;
  const sampleRate = 8000;
  const numSamples = 400; // ~50ms of 16-bit PCM silence
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);
  // Sample bytes are already zero → silence.
  silentUnlockUrl = URL.createObjectURL(
    new Blob([buffer], { type: "audio/wav" }),
  );
  return silentUnlockUrl;
}

/**
 * Grant the persistent audio element autoplay permission for the
 * rest of the SPA session. MUST be called synchronously inside a
 * user gesture (a tap/click handler) — playing the element within a
 * gesture is what the browser's autoplay policy requires to trust
 * subsequent non-gesture plays.
 *
 * Why this exists: the study "get ready" countdown introduces a few
 * seconds between the tap that starts a session and the first card's
 * audio. That delay outlives the browser's gesture-activation window
 * (~5s), so without this pre-unlock the first auto-play — and every
 * one after it, since the element never earned trust — gets silently
 * blocked. Call this in the same click that navigates into a study
 * session. It plays a ~50ms silent clip and pauses; the trust it
 * earns persists because `persistentAudio` is module-level and
 * survives client-side navigation.
 */
// Set once the user has unlocked audio in this SPA session. Gates the
// foreground re-unlock below so we never play the silent clip on pages
// that never use audio.
let audioEverUnlocked = false;

export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  unlockPreparedAudio();
  try {
    if (activeSpeech) return;
    const unlock = ++playbackGeneration;
    const audio = getPersistentAudio();
    audio.src = getSilentUnlockUrl();
    audio.muted = false;
    audio.load();
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        try {
          if (unlock !== playbackGeneration) return;
          audio.pause();
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
      }).catch(() => {
        // Even a rejected play() inside a gesture usually still
        // grants activation; nothing to do on failure.
      });
    }
    audioEverUnlocked = true;
    installForegroundReunlock();
  } catch {
    /* best effort */
  }
}

// Native app activity and browser visibility share one transition source.
// Cancel before iOS suspends JS; returning restarts the same visible card via
// StudySession's activity generation rather than reviving an obsolete source.
let foregroundReunlockInstalled = false;
function installForegroundReunlock(): void {
  if (foregroundReunlockInstalled || typeof document === "undefined") return;
  foregroundReunlockInstalled = true;
  subscribeAppActivity(() => {
    if (!audioEverUnlocked) return;
    if (!getAppActivity().active) { cancelAll(); return; }
    void recoverPreparedAudio();
  });
}

// Every utterance owns its callbacks and cancellation. Old React effect
// cleanups and late lookups must never pause or replace a newer card.
let playbackGeneration = 0;
let activeSpeech: SpeakHandle | null = null;

// ── Client-side URL cache ───────────────────────────────────────────
// (text+lang) → Supabase public URL. Preloader populates it; speak()
// reads it synchronously to skip the /api/tts round trip.
const urlCache = new Map<string, string>();
let audioGeneration = 0;

function cacheKey(text: string, languageCode: string): string {
  return `${languageCode}|${text.trim()}`;
}

/** Synchronously read a preloaded URL. Returns null if not cached. */
export function getCachedAudioUrl(
  text: string,
  languageCode: string,
): string | null {
  const url = urlCache.get(cacheKey(text, languageCode));
  if (url && !url.startsWith("blob:") && typeof navigator !== "undefined" && navigator.onLine === false) return null;
  return url ?? null;
}

// ── In-flight generation dedupe ─────────────────────────────────────
// The single biggest cause of the "~2s wait when the card flips" on a
// brand-new pack: the preloader and speak()'s on-demand path each fired
// their OWN POST /api/tts for the same clip. So when the user flipped to
// a card whose back was still being generated by the preloader, speak()
// didn't see it in urlCache yet (the URL isn't cached until generation
// finishes) and kicked off a SECOND generation from scratch — doubling
// the work and the wait.
//
// resolveAudioUrl() is now the ONE place a clip's URL is fetched. A clip
// that's mid-generation lives in `inFlight`; a second caller (e.g. the
// flip) awaits that SAME promise instead of starting over. So the flip
// plays the instant the preloader's generation lands — never later.
const inFlight = new Map<string, Promise<string | null>>();

function resolveAudioUrl(
  text: string,
  languageCode: string,
): Promise<string | null> {
  const key = cacheKey(text, languageCode);
  const generation = audioGeneration;
  const cached = urlCache.get(key);
  if (cached && (cached.startsWith("blob:") || typeof navigator === "undefined" || navigator.onLine !== false)) return Promise.resolve(cached);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const owner = await deviceOwner().catch(() => null);
    const persisted = owner ? await resolveSavedAudio(owner, text, languageCode).catch(() => null) : null;
    // Read before any write/download: a saved file needs neither a credential
    // refresh nor a second SQLite write to start playing.
    if (owner && persisted) {
      const local = await savedMedia(owner, persisted).catch(() => null);
      if (generation !== audioGeneration) return null;
      if (local) { urlCache.set(key, local); return local; }
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
    const url = persisted || await fetchAudioUrl(text, languageCode);
    if (generation !== audioGeneration) return null;
    if (url) {
      if (owner) {
        if (!persisted) await writeRecord(owner, audioKey(text, languageCode), url).catch(() => {});
        const local = await downloadMedia(owner, url).catch(() => null);
        if (generation !== audioGeneration) return null;
        if (local) { urlCache.set(key, local); return local; }
      }
      if (!owner) urlCache.set(key, url);
      // A failed download remains retryable; don't cache a remote URL as ready.
    }
    return url;
  })().finally(() => {
    if (inFlight.get(key) === p) inFlight.delete(key);
  });
  inFlight.set(key, p);
  return p;
}

/** Load saved bytes and decode ahead. Failure is not retained as readiness. */
export async function preloadAudio(text: string, languageCode: string): Promise<boolean> {
  if (!text.trim() || !languageCode) return false;
  const url = await resolveAudioUrl(text, languageCode).catch(() => null);
  if (!url) return false;
  if (typeof AudioContext === "undefined") return true;
  return prepareAudioBuffer(url);
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
  playbackGeneration++;
  activeSpeech?.cancel();
  activeSpeech = null;
  persistentAudio?.pause();
}

async function fetchAudioUrlOnce(
  text: string,
  languageCode: string,
): Promise<string | null> {
  return (await requestAudioRecording(text, languageCode)).audioUrl;
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
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const first = await fetchAudioUrlOnce(text, languageCode);
  if (first) return first;
  await new Promise((r) => setTimeout(r, 350));
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  return fetchAudioUrlOnce(text, languageCode);
}

/** One owned playback operation, with a single bounded retry for a stalled
 * or interrupted media load. The persistent element retains iOS autoplay trust.
 * Failure is distinct from completion; the study timer must not skip unheard audio.
 */
export function speak(
  text: string,
  options: { languageCode?: string | null; voiceName?: string | null } = {},
): SpeakHandle {
  cancelAll();
  unlockPreparedAudio();
  audioEverUnlocked = true;
  installForegroundReunlock();
  const generation = playbackGeneration;
  const ended: (() => void)[] = [], errors: (() => void)[] = [];
  let cancelled = false, settled = false, attempt = 0;
  let cleanup = () => {};
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const current = () => !cancelled && !settled && generation === playbackGeneration;
  const handle: SpeakHandle = {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(retryTimer);
      cleanup();
      if (activeSpeech === handle) {
        persistentAudio?.pause();
        activeSpeech = null;
      }
    },
    onEnded: cb => ended.push(cb),
    onError: cb => errors.push(cb),
  };
  activeSpeech = handle;
  const finish = (failed: boolean) => {
    if (!current()) return;
    settled = true;
    clearTimeout(retryTimer);
    cleanup();
    if (activeSpeech === handle) {
      if (failed) persistentAudio?.pause();
      activeSpeech = null;
    }
    (failed ? errors : ended).forEach(cb => cb());
  };
  const play = (url: string, resumed = false) => {
    if (!current()) return;
    if (!resumed && isAudioPrepared(url) && getSettings().ttsSpeed === 1) {
      // The ordinary running path remains synchronous. An interrupted output
      // waits for bounded recovery before falling back, never races resume().
      const ready = playPreparedAudio(url, 1, () => finish(false), () => finish(true));
      if (ready) { cleanup = ready; return; }
      void ensurePreparedAudioRunning().then(() => { if (current()) play(url, true); });
      return;
    }
    const prepared = playPreparedAudio(url, getSettings().ttsSpeed, () => finish(false), () => finish(true));
    if (prepared) { cleanup = prepared; return; }
    const audio = getPersistentAudio();
    const thisAttempt = ++attempt;
    let failed = false;
    const valid = () => current() && thisAttempt === attempt && !failed;
    const onPlaying = () => { if (valid()) clearTimeout(timeout); };
    const onEnded = () => { if (valid()) finish(false); };
    const onFailure = (error?: unknown) => {
      if (!valid()) return;
      failed = true;
      cleanup();
      audio.pause();
      // An explicit user gesture is needed for a policy rejection. Don't
      // loop retries; the existing speaker button can start the clip again.
      if (attempt >= 2 || (error instanceof DOMException && error.name === "NotAllowedError")) {
        finish(true);
        return;
      }
      retryTimer = setTimeout(() => play(url), 150);
    };
    const onError = () => onFailure();
    cleanup = () => {
      clearTimeout(timeout);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    const timeout = setTimeout(() => onFailure(), 8000);
    try {
      audio.src = url;
      audio.playbackRate = getSettings().ttsSpeed;
      audio.load();
      void audio.play().then(onPlaying, onFailure);
    } catch (error) { queueMicrotask(() => onFailure(error)); }
  };
  const languageCode = options.languageCode;
  if (!text.trim() || !languageCode) {
    queueMicrotask(() => finish(true));
    return handle;
  }
  const cached = getCachedAudioUrl(text, languageCode);
  if (cached && (!cached.startsWith("blob:") || isAudioPrepared(cached) || typeof AudioContext === "undefined")) play(cached);
  else {
    void (cached ? Promise.resolve(cached) : resolveAudioUrl(text, languageCode)).then(async url => {
      if (!current()) return;
      if (!url) { finish(true); return; }
      await prepareAudioBuffer(url);
      if (current()) play(url);
    }, () => finish(true));
  }
  return handle;
}

export function stopSpeaking() {
  cancelAll();
}

export function clearAudioMemory() {
  audioGeneration++;
  cancelAll();
  clearPreparedAudio();
  urlCache.clear();
  inFlight.clear();
}

export function isTTSSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof Audio !== "undefined";
}
