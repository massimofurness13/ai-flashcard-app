"use client";

import { useEffect, useRef } from "react";

export interface VoicePreloadItem {
  text: string;
  languageCode: string | null | undefined;
}

interface VoicePreloaderProps {
  /** Upcoming (text, languageCode) pairs the user will likely hear soon. */
  items: VoicePreloadItem[];
}

/**
 * Fire-and-forget POST to /api/tts for each upcoming (text, languageCode)
 * so the server-side TTS cache and the CDN both warm up before the user
 * taps the speaker. Once /api/tts has been called for a pair, the Supabase
 * blob exists forever and any future request for the same text+voice
 * returns instantly — making repeat plays and near-future plays feel free.
 *
 * A local `seen` Set ensures we don't re-fire for the same pair across
 * re-renders within a session. We also don't preload pairs without a
 * languageCode (nothing to pre-generate — client would use Web Speech).
 */
export function VoicePreloader({ items }: VoicePreloaderProps) {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const item of items) {
      if (!item.languageCode) continue;
      if (!item.text || !item.text.trim()) continue;
      const key = `${item.languageCode}|${item.text.trim().toLowerCase()}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);

      // Background fetch; response is discarded. Success just means the
      // server-side cache is warm and the CDN URL is resolvable when the
      // user actually taps the speaker on this card.
      void fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: item.text,
          languageCode: item.languageCode,
        }),
      }).catch(() => {
        // Network blip on the preload is fine — real play will retry.
      });
    }
  }, [items]);

  return null;
}
