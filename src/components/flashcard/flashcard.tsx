"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { FlashcardImage } from "./flashcard-image";
import { VoiceButton, speakText } from "./voice-button";

interface FlashcardProps {
  front: string;
  back: string;
  imageUrl?: string | null;
  hint?: string | null;
  isFlipped: boolean;
  onFlip: () => void;
  showImage?: boolean;
  frontVoice?: string | null;
  backVoice?: string | null;
  /** BCP-47 locale per side (e.g. "es-MX", "en-US"). Routes TTS through
   *  the curated Google/ElevenLabs voice for that language. */
  frontLanguageCode?: string | null;
  backLanguageCode?: string | null;
  /** When true, the visible side's text auto-plays via TTS each time
   * the card appears or flips. Study/Review use this; the edit form does not. */
  autoPlayVoice?: boolean;
  className?: string;
}

export function Flashcard({
  front,
  back,
  imageUrl,
  hint,
  isFlipped,
  onFlip,
  showImage = true,
  frontVoice,
  backVoice,
  frontLanguageCode,
  backLanguageCode,
  autoPlayVoice = false,
  className,
}: FlashcardProps) {
  // Prevent the flip animation from playing on initial render
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // Auto-play TTS when the visible side changes. Mobile browsers require
  // a user gesture before the first utterance, so a silent fail here is
  // fine — the first click of Show Answer or the card itself unlocks it.
  useEffect(() => {
    if (!autoPlayVoice) return;
    const text = isFlipped ? back : front;
    const voice = isFlipped ? backVoice : frontVoice;
    const lang = isFlipped ? backLanguageCode : frontLanguageCode;
    const handle = speakText(text, { languageCode: lang, voiceName: voice });
    return () => handle.cancel();
  }, [autoPlayVoice, isFlipped, front, back, frontVoice, backVoice, frontLanguageCode, backLanguageCode]);

  return (
    <div
      className={cn("flashcard-container w-full max-w-md mx-auto", className)}
      style={{ minHeight: "320px" }}
    >
      <div
        className={cn(
          "flashcard-inner cursor-pointer",
          mounted && "flashcard-animated",
          isFlipped && "flipped"
        )}
        onClick={onFlip}
        style={{ minHeight: "320px" }}
      >
        {/* Front face */}
        <div className="flashcard-front rounded-2xl border border-border bg-card shadow-lg p-6 flex flex-col">
          {showImage && (
            <div className="mb-4 flex justify-center">
              <FlashcardImage imageUrl={imageUrl} cardText={front} />
            </div>
          )}
          <div className="flex-1 flex items-center justify-center">
            <p className="text-lg font-medium text-center text-card-foreground">
              {front}
            </p>
          </div>
          <div className="flex items-center justify-between mt-4">
            {hint && (
              <p className="text-xs text-muted-foreground italic">
                Hint: {hint}
              </p>
            )}
            <VoiceButton
              text={front}
              languageCode={frontLanguageCode}
              voiceName={frontVoice}
              className="ml-auto"
            />
          </div>
        </div>

        {/* Back face */}
        <div className="flashcard-back rounded-2xl border border-border bg-card shadow-lg p-6 flex flex-col">
          {showImage && (
            <div className="mb-4 flex justify-center">
              <FlashcardImage imageUrl={imageUrl} cardText={front} />
            </div>
          )}
          <div className="flex-1 flex items-center justify-center">
            <p className="text-lg text-center text-card-foreground">{back}</p>
          </div>
          <div className="flex justify-end mt-4">
            <VoiceButton
              text={back}
              languageCode={backLanguageCode}
              voiceName={backVoice}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
