/**
 * Voice Catalog — curated mapping from internal language codes to Google
 * Cloud TTS voices. Every voice is a Chirp 3 HD native speaker of the
 * target locale (Google's 2024 generation, near-ElevenLabs quality).
 *
 * Convention:
 *   - Code ending with no suffix (e.g. "es-ES") = default/female voice
 *   - Code ending in "-m" (e.g. "es-ES-m")     = male voice
 *   Existing decks stored with unsuffixed codes keep working — suffixed
 *   entries are purely additive.
 *
 * Female voice: Chirp3-HD-Aoede  (clear, warm)
 * Male voice:   Chirp3-HD-Charon (grounded, conversational)
 *
 * Fallback: if Google doesn't offer Chirp 3 HD for a specific locale,
 * generateGoogle() in tts-server.ts auto-retries without a voice name,
 * letting Google pick any native-speaker voice for that language. So a
 * catalog entry that turns out to be stale still produces correct audio.
 */

export type VoiceEntry = {
  code: string;
  /** Shown in the UI — e.g. "Spanish (Spain) — Female" */
  label: string;
  /** Shown in native script on language-browse pages — e.g. "Español (España)" */
  nativeLabel: string;
  /** Used to group entries under a shared optgroup in the deck form */
  group: string;
  gender: "female" | "male";
  google: {
    name: string;
    languageCode: string;
  };
};

// ────────────────────────────────────────────────────────────────────────
// Helpers to keep the catalog readable — two lines per language instead
// of the sixteen we'd need if we wrote each entry long-hand.
// ────────────────────────────────────────────────────────────────────────

function pair(
  group: string,
  code: string,
  languageCode: string,
  labels: { label: string; nativeLabel: string }
): VoiceEntry[] {
  return [
    {
      code,
      label: `${labels.label} — Female`,
      nativeLabel: labels.nativeLabel,
      group,
      gender: "female",
      google: { name: `${languageCode}-Chirp3-HD-Aoede`, languageCode },
    },
    {
      code: `${code}-m`,
      label: `${labels.label} — Male`,
      nativeLabel: labels.nativeLabel,
      group,
      gender: "male",
      google: { name: `${languageCode}-Chirp3-HD-Charon`, languageCode },
    },
  ];
}

export const VOICE_CATALOG: VoiceEntry[] = [
  // ── English ──────────────────────────────────────────────────────────
  ...pair("English", "en-US", "en-US", { label: "English (US)", nativeLabel: "English (US)" }),
  ...pair("English", "en-GB", "en-GB", { label: "English (UK)", nativeLabel: "English (UK)" }),
  ...pair("English", "en-AU", "en-AU", { label: "English (Australia)", nativeLabel: "English (Australia)" }),
  ...pair("English", "en-IN", "en-IN", { label: "English (India)", nativeLabel: "English (India)" }),

  // ── Spanish ──────────────────────────────────────────────────────────
  ...pair("Spanish", "es-ES", "es-ES", { label: "Spanish (Spain)", nativeLabel: "Español (España)" }),
  ...pair("Spanish", "es-MX", "es-MX", { label: "Spanish (Mexico)", nativeLabel: "Español (México)" }),
  ...pair("Spanish", "es-US", "es-US", { label: "Spanish (Latin America)", nativeLabel: "Español (Latinoamérica)" }),

  // ── French ───────────────────────────────────────────────────────────
  ...pair("French", "fr-FR", "fr-FR", { label: "French (France)", nativeLabel: "Français (France)" }),
  ...pair("French", "fr-CA", "fr-CA", { label: "French (Canada)", nativeLabel: "Français (Canada)" }),

  // ── Portuguese ───────────────────────────────────────────────────────
  ...pair("Portuguese", "pt-BR", "pt-BR", { label: "Portuguese (Brazil)", nativeLabel: "Português (Brasil)" }),
  ...pair("Portuguese", "pt-PT", "pt-PT", { label: "Portuguese (Portugal)", nativeLabel: "Português (Portugal)" }),

  // ── Central / Northern European ──────────────────────────────────────
  ...pair("Germanic", "de-DE", "de-DE", { label: "German", nativeLabel: "Deutsch" }),
  ...pair("Germanic", "nl-NL", "nl-NL", { label: "Dutch", nativeLabel: "Nederlands" }),
  ...pair("Germanic", "sv-SE", "sv-SE", { label: "Swedish", nativeLabel: "Svenska" }),
  ...pair("Germanic", "da-DK", "da-DK", { label: "Danish", nativeLabel: "Dansk" }),
  ...pair("Germanic", "nb-NO", "nb-NO", { label: "Norwegian", nativeLabel: "Norsk (bokmål)" }),
  ...pair("Germanic", "fi-FI", "fi-FI", { label: "Finnish", nativeLabel: "Suomi" }),

  // ── Romance / Mediterranean ──────────────────────────────────────────
  ...pair("Romance", "it-IT", "it-IT", { label: "Italian", nativeLabel: "Italiano" }),
  ...pair("Romance", "ro-RO", "ro-RO", { label: "Romanian", nativeLabel: "Română" }),
  ...pair("Romance", "el-GR", "el-GR", { label: "Greek", nativeLabel: "Ελληνικά" }),

  // ── Slavic ───────────────────────────────────────────────────────────
  ...pair("Slavic", "pl-PL", "pl-PL", { label: "Polish", nativeLabel: "Polski" }),
  ...pair("Slavic", "ru-RU", "ru-RU", { label: "Russian", nativeLabel: "Русский" }),
  ...pair("Slavic", "uk-UA", "uk-UA", { label: "Ukrainian", nativeLabel: "Українська" }),
  ...pair("Slavic", "cs-CZ", "cs-CZ", { label: "Czech", nativeLabel: "Čeština" }),

  // ── Asian ────────────────────────────────────────────────────────────
  ...pair("Asian", "ja-JP", "ja-JP", { label: "Japanese", nativeLabel: "日本語" }),
  ...pair("Asian", "ko-KR", "ko-KR", { label: "Korean", nativeLabel: "한국어" }),
  ...pair("Asian", "zh-CN", "cmn-CN", { label: "Chinese (Mandarin)", nativeLabel: "中文 (普通话)" }),
  ...pair("Asian", "hi-IN", "hi-IN", { label: "Hindi", nativeLabel: "हिन्दी" }),
  ...pair("Asian", "th-TH", "th-TH", { label: "Thai", nativeLabel: "ไทย" }),
  ...pair("Asian", "vi-VN", "vi-VN", { label: "Vietnamese", nativeLabel: "Tiếng Việt" }),
  ...pair("Asian", "id-ID", "id-ID", { label: "Indonesian", nativeLabel: "Bahasa Indonesia" }),

  // ── Middle Eastern ───────────────────────────────────────────────────
  ...pair("Middle Eastern", "ar-SA", "ar-XA", { label: "Arabic", nativeLabel: "العربية" }),
  ...pair("Middle Eastern", "tr-TR", "tr-TR", { label: "Turkish", nativeLabel: "Türkçe" }),
  ...pair("Middle Eastern", "he-IL", "iw-IL", { label: "Hebrew", nativeLabel: "עברית" }),
];

/** Distinct optgroup keys, preserving the catalog's insertion order. */
export function getVoiceGroups(): string[] {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const v of VOICE_CATALOG) {
    if (!seen.has(v.group)) {
      seen.add(v.group);
      groups.push(v.group);
    }
  }
  return groups;
}

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
 * Pick the provider+voice for a given language entry. Single-provider
 * today (Google Chirp 3 HD). Tagged object form keeps the door open
 * for adding providers later without breaking callers.
 */
export function resolveVoice(entry: VoiceEntry): ResolvedVoice {
  return {
    provider: "google",
    voiceName: entry.google.name,
    languageCode: entry.google.languageCode,
    entry,
  };
}
