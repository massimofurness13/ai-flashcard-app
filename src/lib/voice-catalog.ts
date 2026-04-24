/**
 * Voice Catalog — curated mapping from BCP-47 language codes to TTS voices
 * across providers.
 *
 * Two tiers per language:
 *   - `google`: always populated. Used for free users and as a fallback.
 *   - `elevenlabs`: optional. When present, Pro users get this premium voice.
 *     Populate with voice IDs curated from https://elevenlabs.io/app/voice-library
 *     after auditioning — quality varies between community voices.
 *
 * To audition a new ElevenLabs voice:
 *   1. Visit the voice library, filter by language
 *   2. Listen to samples in the target language (important — some voices
 *      trained on English bleed an English accent into other languages)
 *   3. Add the voice to your ElevenLabs account ("Add to VoiceLab")
 *   4. Copy the voice ID from the URL or the voice settings page
 *   5. Add it to the `elevenlabs` field below
 *
 * Adding a new language: add an entry here, update the dropdown copy in the
 * deck form, and optionally add a default voice mapping for legacy decks
 * without a language code set.
 */

export type VoiceEntry = {
  code: string;
  label: string;
  nativeLabel: string;
  google: {
    // Google Cloud TTS voice name, e.g. "es-MX-Neural2-A"
    name: string;
    // BCP-47 locale the voice speaks — must match the voice's language
    languageCode: string;
  };
  elevenlabs?: {
    // Public voice ID from ElevenLabs voice library
    voiceId: string;
    // Model for multilingual synthesis. `eleven_multilingual_v2` supports
    // 29 languages and preserves native accent of cloned voices.
    model: "eleven_multilingual_v2" | "eleven_turbo_v2_5" | "eleven_flash_v2_5";
  };
};

export const VOICE_CATALOG: VoiceEntry[] = [
  // ── English ──────────────────────────────────────────────────────────
  {
    code: "en-US",
    label: "English (US)",
    nativeLabel: "English (US)",
    google: { name: "en-US-Neural2-F", languageCode: "en-US" },
    elevenlabs: {
      voiceId: "EXAVITQu4vr4xnSDxMaL", // Bella — warm, clear American female
      model: "eleven_multilingual_v2",
    },
  },
  {
    code: "en-GB",
    label: "English (UK)",
    nativeLabel: "English (UK)",
    google: { name: "en-GB-Neural2-A", languageCode: "en-GB" },
    elevenlabs: {
      voiceId: "CYw3kZ02Hs0563khs1Fj", // Dave — British English male
      model: "eleven_multilingual_v2",
    },
  },
  {
    code: "en-AU",
    label: "English (Australia)",
    nativeLabel: "English (Australia)",
    google: { name: "en-AU-Neural2-A", languageCode: "en-AU" },
    elevenlabs: {
      voiceId: "IKne3meq5aSn9XLyUdCD", // Charlie — Australian male, casual
      model: "eleven_multilingual_v2",
    },
  },
  {
    code: "en-IN",
    label: "English (India)",
    nativeLabel: "English (India)",
    google: { name: "en-IN-Wavenet-A", languageCode: "en-IN" },
    elevenlabs: {
      voiceId: "JBFqnCBsd6RMkjVDRZzb", // George — British male, warm (closest to Indian-English register)
      model: "eleven_multilingual_v2",
    },
  },

  // ── Spanish (regional variants) ──────────────────────────────────────
  {
    code: "es-ES",
    label: "Spanish (Spain)",
    nativeLabel: "Español (España)",
    google: { name: "es-ES-Neural2-A", languageCode: "es-ES" },
    elevenlabs: {
      voiceId: "ErXwobaYiN019PkySvjV", // Antoni — warm male, works well in Spanish
      model: "eleven_multilingual_v2",
    },
  },
  {
    code: "es-MX",
    label: "Spanish (Mexico)",
    nativeLabel: "Español (México)",
    // Google does not offer Neural2 for es-MX, only Wavenet/Standard.
    google: { name: "es-MX-Wavenet-A", languageCode: "es-MX" },
    elevenlabs: {
      voiceId: "AZnzlk1XvdvUeBnXmlld", // Domi — strong female
      model: "eleven_multilingual_v2",
    },
  },
  {
    code: "es-US",
    label: "Spanish (Latin America)",
    nativeLabel: "Español (Latinoamérica)",
    google: { name: "es-US-Neural2-A", languageCode: "es-US" },
    elevenlabs: {
      voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel — clear neutral female
      model: "eleven_multilingual_v2",
    },
  },

  // ── French ───────────────────────────────────────────────────────────
  {
    code: "fr-FR",
    label: "French (France)",
    nativeLabel: "Français (France)",
    google: { name: "fr-FR-Neural2-A", languageCode: "fr-FR" },
    elevenlabs: {
      voiceId: "MF3mGyEYCl7XYWbV9V6O", // Elli — young female, natural French pronunciation
      model: "eleven_multilingual_v2",
    },
  },
  {
    code: "fr-CA",
    label: "French (Canada)",
    nativeLabel: "Français (Canada)",
    google: { name: "fr-CA-Neural2-A", languageCode: "fr-CA" },
    elevenlabs: {
      voiceId: "TxGEqnHWrfWFTfGW9XjX", // Josh — young male
      model: "eleven_multilingual_v2",
    },
  },

  // ── German ───────────────────────────────────────────────────────────
  {
    code: "de-DE",
    label: "German",
    nativeLabel: "Deutsch",
    google: { name: "de-DE-Neural2-A", languageCode: "de-DE" },
    elevenlabs: {
      voiceId: "VR6AewLTigWG4xSOukaG", // Arnold — crisp male, strong consonants suit German
      model: "eleven_multilingual_v2",
    },
  },

  // ── Italian ──────────────────────────────────────────────────────────
  {
    code: "it-IT",
    label: "Italian",
    nativeLabel: "Italiano",
    google: { name: "it-IT-Neural2-A", languageCode: "it-IT" },
    elevenlabs: {
      voiceId: "piTKgcLEGmPE4e6mEKli", // Nicole — soft female, fluid in Italian
      model: "eleven_multilingual_v2",
    },
  },

  // ── Portuguese ───────────────────────────────────────────────────────
  {
    code: "pt-BR",
    label: "Portuguese (Brazil)",
    nativeLabel: "Português (Brasil)",
    google: { name: "pt-BR-Neural2-A", languageCode: "pt-BR" },
    elevenlabs: {
      voiceId: "pNInz6obpgDQGcFmaJgB", // Adam — deep male, suits Brazilian PT
      model: "eleven_multilingual_v2",
    },
  },
  {
    code: "pt-PT",
    label: "Portuguese (Portugal)",
    nativeLabel: "Português (Portugal)",
    google: { name: "pt-PT-Wavenet-A", languageCode: "pt-PT" },
    elevenlabs: {
      voiceId: "XrExE9yKIg1WjnnlVkGX", // Matilda — warm female
      model: "eleven_multilingual_v2",
    },
  },

  // ── Asian languages ──────────────────────────────────────────────────
  {
    code: "ja-JP",
    label: "Japanese",
    nativeLabel: "日本語",
    google: { name: "ja-JP-Neural2-B", languageCode: "ja-JP" },
  },
  {
    code: "ko-KR",
    label: "Korean",
    nativeLabel: "한국어",
    google: { name: "ko-KR-Neural2-A", languageCode: "ko-KR" },
  },
  {
    code: "zh-CN",
    label: "Chinese (Mandarin)",
    nativeLabel: "中文 (普通话)",
    google: { name: "cmn-CN-Wavenet-A", languageCode: "cmn-CN" },
  },

  // ── Other ────────────────────────────────────────────────────────────
  {
    code: "ru-RU",
    label: "Russian",
    nativeLabel: "Русский",
    google: { name: "ru-RU-Wavenet-C", languageCode: "ru-RU" },
    elevenlabs: {
      voiceId: "yoZ06aMxZJJ28mfd3POQ", // Sam — raspy male, works for Russian tone
      model: "eleven_multilingual_v2",
    },
  },
  {
    code: "ar-SA",
    label: "Arabic",
    nativeLabel: "العربية",
    google: { name: "ar-XA-Wavenet-A", languageCode: "ar-XA" },
  },
  {
    code: "hi-IN",
    label: "Hindi",
    nativeLabel: "हिन्दी",
    google: { name: "hi-IN-Wavenet-A", languageCode: "hi-IN" },
  },
  {
    code: "nl-NL",
    label: "Dutch",
    nativeLabel: "Nederlands",
    google: { name: "nl-NL-Wavenet-D", languageCode: "nl-NL" },
    elevenlabs: {
      voiceId: "XB0fDUnXU5powFXDhCwa", // Charlotte — soft female
      model: "eleven_multilingual_v2",
    },
  },
];

/**
 * Look up a catalog entry by language code. Returns null if unknown —
 * callers should fall back to browser Web Speech in that case.
 */
export function getVoiceEntry(code: string | null | undefined): VoiceEntry | null {
  if (!code) return null;
  return VOICE_CATALOG.find((v) => v.code === code) ?? null;
}

/**
 * Decide which provider+voice to use for a given request. Pro users get
 * ElevenLabs when curated; everyone else gets Google.
 */
export type ResolvedVoice =
  | { provider: "elevenlabs"; voiceId: string; model: string; entry: VoiceEntry }
  | { provider: "google"; voiceName: string; languageCode: string; entry: VoiceEntry };

export function resolveVoice(
  entry: VoiceEntry,
  isPro: boolean
): ResolvedVoice {
  if (isPro && entry.elevenlabs) {
    return {
      provider: "elevenlabs",
      voiceId: entry.elevenlabs.voiceId,
      model: entry.elevenlabs.model,
      entry,
    };
  }
  return {
    provider: "google",
    voiceName: entry.google.name,
    languageCode: entry.google.languageCode,
    entry,
  };
}
