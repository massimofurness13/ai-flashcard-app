"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface VoiceButtonProps {
  text: string;
  voiceName?: string | null;
  className?: string;
}

function getSettings(): { voice: string; ttsSpeed: number } {
  try {
    const saved = localStorage.getItem("flashmind-settings");
    if (saved) {
      const s = JSON.parse(saved);
      return { voice: s.voice || "", ttsSpeed: s.ttsSpeed || 1 };
    }
  } catch { /* ignore */ }
  return { voice: "", ttsSpeed: 1 };
}

export function VoiceButton({ text, voiceName, className }: VoiceButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  const handleClick = useCallback(() => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    setSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    const settings = getSettings();

    // Voice priority: 1) per-deck voiceName prop, 2) global setting, 3) browser default
    const targetName = voiceName || settings.voice;
    if (targetName) {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.name === targetName);
      if (match) utterance.voice = match;
    }

    utterance.rate = settings.ttsSpeed;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [text, voiceName, speaking]);

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
