/**
 * Voice Catalog — curated mapping from BCP-47 language codes to Google
 * Cloud TTS voices. Every voice in the catalog is from a native speaker
 * of the target locale, recorded by Google. We prefer Chirp 3 HD (their
 * 2024 generation, near-ElevenLabs quality) where available and fall
 * back to Neural2 / Wavenet for locales where Chirp 3 HD isn't offered.
 *
 * If a specific voice name in this catalog turns out to be stale — Google
 * occasionally deprecates voices — the generateGoogle() function in
 * tts-server.ts auto-retries without a voice name, letting Google pick
 * any available voice for the language. So this catalog is a preference,
 * not a hard dependency.
 *
 * To add a language: add an entry. To change the voice for a language,
 * change the `google.name` field — voice names follow the pattern
 * `{locale}-{Tier}-{VoiceName}`, e.g. `es-MX-Chirp3-HD-Aoede`.
 */

export type VoiceEntry = {
  code: string;
  label: string;
  nativeLabel: string;
  google: {
    /** Google Cloud TTS voice name, e.g. "es-MX-Chirp3-HD-Aoede" */
    name: string;
    /** BCP-47 locale the voice speaks. Must match the voice's language. */
    languageCode: string;
  };
};

export const VOICE_CATALOG: VoiceEntry[] = [
  // ── English ──────────────────────────────────────────────────────────
  {
    code: "en-US",
    label: "English (US)",
    nativeLabel: "English (US)",
    google: { name: "en-US-Chirp3-HD-Aoede", languageCode: "en-US" },
  },
  {
    code: "en-GB",
    label: "English (UK)",
    nativeLabel: "English (UK)",
    google: { name: "en-GB-Chirp3-HD-Aoede", languageCode: "en-GB" },
  },
  {
    code: "en-AU",
    label: "English (Australia)",
    nativeLabel: "English (Australia)",
    google: { name: "en-AU-Chirp3-HD-Aoede", languageCode: "en-AU" },
  },
  {
    code: "en-IN",
    label: "English (India)",
    nativeLabel: "English (India)",
    google: { name: "en-IN-Chirp3-HD-Aoede", languageCode: "en-IN" },
  },

  // ── Spanish (regional variants) ──────────────────────────────────────
  {
    code: "es-ES",
    label: "Spanish (Spain)",
    nativeLabel: "Español (España)",
    google: { name: "es-ES-Chirp3-HD-Aoede", languageCode: "es-ES" },
  },
  {
    code: "es-MX",
    label: "Spanish (Mexico)",
    nativeLabel: "Español (México)",
    google: { name: "es-MX-Chirp3-HD-Aoede", languageCode: "es-MX" },
  },
  {
    code: "es-US",
    label: "Spanish (Latin America)",
    nativeLabel: "Español (Latinoamérica)",
    google: { name: "es-US-Chirp3-HD-Aoede", languageCode: "es-US" },
  },

  // ── French ───────────────────────────────────────────────────────────
  {
    code: "fr-FR",
    label: "French (France)",
    nativeLabel: "Français (France)",
    google: { name: "fr-FR-Chirp3-HD-Aoede", languageCode: "fr-FR" },
  },
  {
    code: "fr-CA",
    label: "French (Canada)",
    nativeLabel: "Français (Canada)",
    google: { name: "fr-CA-Chirp3-HD-Aoede", languageCode: "fr-CA" },
  },

  // ── German ───────────────────────────────────────────────────────────
  {
    code: "de-DE",
    label: "German",
    nativeLabel: "Deutsch",
    google: { name: "de-DE-Chirp3-HD-Aoede", languageCode: "de-DE" },
  },

  // ── Italian ──────────────────────────────────────────────────────────
  {
    code: "it-IT",
    label: "Italian",
    nativeLabel: "Italiano",
    google: { name: "it-IT-Chirp3-HD-Aoede", languageCode: "it-IT" },
  },

  // ── Portuguese ───────────────────────────────────────────────────────
  {
    code: "pt-BR",
    label: "Portuguese (Brazil)",
    nativeLabel: "Português (Brasil)",
    google: { name: "pt-BR-Chirp3-HD-Aoede", languageCode: "pt-BR" },
  },
  {
    code: "pt-PT",
    label: "Portuguese (Portugal)",
    nativeLabel: "Português (Portugal)",
    google: { name: "pt-PT-Wavenet-A", languageCode: "pt-PT" },
  },

  // ── Asian languages ──────────────────────────────────────────────────
  {
    code: "ja-JP",
    label: "Japanese",
    nativeLabel: "日本語",
    google: { name: "ja-JP-Chirp3-HD-Aoede", languageCode: "ja-JP" },
  },
  {
    code: "ko-KR",
    label: "Korean",
    nativeLabel: "한국어",
    google: { name: "ko-KR-Chirp3-HD-Aoede", languageCode: "ko-KR" },
  },
  {
    code: "zh-CN",
    label: "Chinese (Mandarin)",
    nativeLabel: "中文 (普通话)",
    google: { name: "cmn-CN-Chirp3-HD-Aoede", languageCode: "cmn-CN" },
  },

  // ── Other ────────────────────────────────────────────────────────────
  {
    code: "ru-RU",
    label: "Russian",
    nativeLabel: "Русский",
    google: { name: "ru-RU-Chirp3-HD-Aoede", languageCode: "ru-RU" },
  },
  {
    code: "ar-SA",
    label: "Arabic",
    nativeLabel: "العربية",
    google: { name: "ar-XA-Chirp3-HD-Aoede", languageCode: "ar-XA" },
  },
  {
    code: "hi-IN",
    label: "Hindi",
    nativeLabel: "हिन्दी",
    google: { name: "hi-IN-Chirp3-HD-Aoede", languageCode: "hi-IN" },
  },
  {
    code: "nl-NL",
    label: "Dutch",
    nativeLabel: "Nederlands",
    google: { name: "nl-NL-Chirp3-HD-Aoede", languageCode: "nl-NL" },
  },
];

/**
 * Look up a catalog entry by language code. Returns null if unknown —
 * callers fall back to browser Web Speech in that case.
 */
export function getVoiceEntry(code: string | null | undefined): VoiceEntry | null {
  if (!code) return null;
  return VOICE_CATALOG.find((v) => v.code === code) ?? null;
}

export type ResolvedVoice = {
  provider: "google";
  voiceName: string;
  languageCode: string;
  entry: VoiceEntry;
};

/**
 * Pick the provider+voice for a given language. Single-provider today
 * (Google Chirp 3 HD + native-speaker Neural2/Wavenet fallback). The
 * tagged object keeps the door open for adding providers later without
 * changing callers.
 */
export function resolveVoice(entry: VoiceEntry): ResolvedVoice {
  return {
    provider: "google",
    voiceName: entry.google.name,
    languageCode: entry.google.languageCode,
    entry,
  };
}
