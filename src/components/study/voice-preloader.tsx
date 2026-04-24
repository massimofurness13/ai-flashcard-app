"use client";

import { useEffect, useRef } from "react";
import { preloadAudio } from "@/lib/tts";

export interface VoicePreloadItem {
  text: string;
  languageCode: string | null | undefined;
}

interface VoicePreloaderProps {
  /** Upcoming (text, languageCode) pairs the user will likely hear soon. */
  items: VoicePreloadItem[];
}

/**
 * Warms both the client-side URL cache (so speak() skips /api/tts) and
 * the browser's HTTP cache for the MP3 bytes (so the Audio element
 * skips the CDN fetch). Together they take a cold card-to-audio start
 * from ~500-900ms down to ~50ms.
 *
 * A local `seen` Set deduplicates across re-renders — we never issue
 * the same preload twice within a session.
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
      void preloadAudio(item.text, item.languageCode);
    }
  }, [items]);

  return null;
}
