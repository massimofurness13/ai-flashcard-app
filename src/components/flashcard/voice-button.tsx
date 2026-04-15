"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { speak, stopSpeaking } from "@/lib/tts";

interface VoiceButtonProps {
  text: string;
  className?: string;
}

export function VoiceButton({ text, className }: VoiceButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  function handleClick() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }

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
