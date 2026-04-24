"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { speak, type SpeakHandle } from "@/lib/tts";

interface VoiceButtonProps {
  text: string;
  /** BCP-47 locale from the deck (e.g. "es-MX"). When set, plays the
   *  curated Google/ElevenLabs voice via the server TTS API. */
  languageCode?: string | null;
  /** Legacy per-deck Web Speech voice name — used only as a fallback
   *  when no languageCode is set. */
  voiceName?: string | null;
  className?: string;
}

/**
 * Speak text using the server TTS API (via language code) with Web Speech
 * as a fallback. Returns a handle so callers can listen for onEnded /
 * cancel when the component unmounts or the user advances.
 */
export function speakText(
  text: string,
  options: { languageCode?: string | null; voiceName?: string | null } = {}
): SpeakHandle {
  return speak(text, options);
}

export function VoiceButton({
  text,
  languageCode,
  voiceName,
  className,
}: VoiceButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const handleRef = useRef<SpeakHandle | null>(null);

  const handleClick = useCallback(() => {
    if (speaking) {
      handleRef.current?.cancel();
      handleRef.current = null;
      setSpeaking(false);
      return;
    }

    setSpeaking(true);
    const handle = speak(text, { languageCode, voiceName });
    handleRef.current = handle;
    handle.onEnded?.(() => setSpeaking(false));
    handle.onError?.(() => setSpeaking(false));
  }, [text, languageCode, voiceName, speaking]);

  useEffect(() => {
    return () => handleRef.current?.cancel();
  }, []);

  if (typeof window === "undefined") return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        handleClick();
      }}
      aria-label={speaking ? "Stop reading" : "Read aloud"}
    >
      {speaking ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h6v4H9z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      )}
    </Button>
  );
}
