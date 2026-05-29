/**
 * Maps the short learning-language codes we store on the User row
 * (from onboarding: "es", "fr", …) to the BCP-47 locale codes the
 * TTS voice catalog uses ("es-ES", "fr-FR", …).
 *
 * Used in two places:
 *   1. Onboarding — stamps a starter pack's front/back language so
 *      a brand-new user hears native-speaker audio immediately.
 *   2. Study session voice fallback — when a deck has NO language
 *      code set (e.g. an AI-generated pack where the user skipped
 *      the language picker), we fall back to the user's learning
 *      language for the front and English for the back. This is
 *      what guarantees we NEVER drop to the robotic Web Speech
 *      device voice — a hard product requirement.
 *
 * `back` defaults to en-GB because the overwhelmingly common
 * flashcard shape is "foreign word on the front, English gloss on
 * the back". A user who's actually learning English (front === en)
 * still gets en-GB on both sides, which is correct.
 */
export const LANGUAGE_TO_BCP47: Record<
  string,
  { front: string; back: string }
> = {
  es: { front: "es-ES", back: "en-GB" },
  fr: { front: "fr-FR", back: "en-GB" },
  de: { front: "de-DE", back: "en-GB" },
  it: { front: "it-IT", back: "en-GB" },
  pt: { front: "pt-PT", back: "en-GB" },
  ja: { front: "ja-JP", back: "en-GB" },
  ko: { front: "ko-KR", back: "en-GB" },
  zh: { front: "cmn-CN", back: "en-GB" },
  en: { front: "en-GB", back: "en-GB" },
};

/**
 * Resolve the front/back voice fallback for a user whose deck has
 * no explicit language codes. Returns null for the front when the
 * learning language is unknown/unmapped — callers treat a null
 * front-fallback as "stay silent rather than guess", but the back
 * always gets English so the gloss side is at least spoken.
 */
export function fallbackVoiceCodes(
  learningLanguage: string | null | undefined,
): { front: string | null; back: string } {
  if (learningLanguage && LANGUAGE_TO_BCP47[learningLanguage]) {
    return LANGUAGE_TO_BCP47[learningLanguage];
  }
  return { front: null, back: "en-GB" };
}
