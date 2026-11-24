"use client";

import { useEffect } from "react";
import { preloadAudio } from "@/lib/tts";

export interface VoicePreloadItem {
  text: string;
  languageCode: string | null | undefined;
}

interface VoicePreloaderProps {
  /** Upcoming (text, languageCode) pairs the user will likely hear soon. */
  items: VoicePreloadItem[];
}

/** Warm the bounded decoded cache. Failed or evicted entries remain retryable. */
export function VoicePreloader({ items }: VoicePreloaderProps) {
  useEffect(() => {
    const warm = () => {
      if (document.visibilityState === "hidden") return;
      for (const item of items) if (item.languageCode && item.text?.trim()) void preloadAudio(item.text, item.languageCode);
    };
    warm();
    const retry = setInterval(warm, 5000);
    window.addEventListener("online", warm);
    document.addEventListener("visibilitychange", warm);
    return () => { clearInterval(retry); window.removeEventListener("online", warm); document.removeEventListener("visibilitychange", warm); };
  }, [items]);

  return null;
}
