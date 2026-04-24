/**
 * Client TTS entry points. Primary path is the server API (`/api/tts`)
 * which returns a cached Supabase MP3 URL using Google Cloud TTS for
 * free users and ElevenLabs Multilingual v2 for Pro users. Web Speech
 * API is kept as a last-resort fallback for:
 *   - decks without a language code set (legacy / hand-made cards)
 *   - offline / API errors
 *   - unsupported languages
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
 * (premium voice per language). Otherwise falls back to browser
 * Web Speech with optional voiceName override.
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
    const handle: SpeakHandle = {
      cancel: () => cancelAll(),
      onEnded: undefined,
      onError: undefined,
    };
    const endedCbs: (() => void)[] = [];
    const errorCbs: (() => void)[] = [];
    handle.onEnded = (cb) => endedCbs.push(cb);
    handle.onError = (cb) => errorCbs.push(cb);

    // Kick off async fetch; wire up inner handle's callbacks to ours.
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
