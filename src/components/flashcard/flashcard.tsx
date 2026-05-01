"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { FlashcardImage } from "./flashcard-image";
import { VoiceButton, speakText } from "./voice-button";

interface FlashcardProps {
  front: string;
  back: string;
  imageUrl?: string | null;
  /** "quick" | "premium" — drives the small tier badge on the
   *  card image so the user can see the difference between the
   *  two AI tiers at a glance. */
  imageTier?: "quick" | "premium" | null;
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
  /** Fires when the auto-played TTS clip finishes (or fails / is
   *  cancelled mid-play). Study session uses this to start the
   *  auto-advance countdown — so the timer never overlaps with the
   *  audio. Only meaningful when `autoPlayVoice` is true. */
  onAudioEnd?: () => void;
  /** When true, suppresses auto-play. If a clip is currently playing
   *  it gets cancelled. Going from paused → unpaused does NOT replay
   *  audio for the same side — the user has already heard it. */
  paused?: boolean;
  /** When false, AI-generated images are blurred behind a "Resubscribe
   *  to view" overlay. Lapsed Pro users keep their text + audio but lose
   *  visibility on illustrations until they renew. */
  isPro?: boolean;
  className?: string;
}

export function Flashcard({
  front,
  back,
  imageUrl,
  imageTier,
  hint,
  isFlipped,
  onFlip,
  showImage = true,
  frontVoice,
  backVoice,
  frontLanguageCode,
  backLanguageCode,
  autoPlayVoice = false,
  onAudioEnd,
  paused = false,
  isPro = true,
  className,
}: FlashcardProps) {
  // Prevent the flip animation from playing on initial render
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // Stash onAudioEnd in a ref so it can be called from the audio
  // effect WITHOUT being a dependency. Including the prop in deps
  // would re-run the effect every parent re-render (the parent
  // typically passes a fresh arrow function), which cancels the
  // in-flight TTS handle and starts a new one — manifesting as the
  // clip playing twice in a row.
  const onAudioEndRef = useRef(onAudioEnd);
  useEffect(() => {
    onAudioEndRef.current = onAudioEnd;
  }, [onAudioEnd]);

  // Auto-play TTS when the visible side changes. Mobile browsers
  // require a user gesture before the first utterance, so a silent
  // fail here is fine — the first click of Show Answer or the card
  // itself unlocks it. We notify the parent (via the ref) when audio
  // ends, errors, or is cancelled so the study session can start its
  // auto-advance/auto-flip countdown only after speech completes.
  //
  // When `paused` is true we skip starting playback entirely — and
  // any in-flight handle from a previous render is cancelled by the
  // cleanup. We deliberately fire the audio-end signal in that case
  // so a paused → resumed cycle doesn't leave the parent's
  // audioFinished gate stuck closed; the user has effectively
  // "heard" the audio enough that the countdown should be allowed
  // to continue from where it was paused.
  useEffect(() => {
    if (!autoPlayVoice) return;
    if (paused) {
      onAudioEndRef.current?.();
      return;
    }
    const text = isFlipped ? back : front;
    const voice = isFlipped ? backVoice : frontVoice;
    const lang = isFlipped ? backLanguageCode : frontLanguageCode;
    const handle = speakText(text, { languageCode: lang, voiceName: voice });
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      onAudioEndRef.current?.();
    };
    handle.onEnded?.(fire);
    handle.onError?.(fire);
    return () => {
      handle.cancel();
      fire();
    };
  }, [autoPlayVoice, paused, isFlipped, front, back, frontVoice, backVoice, frontLanguageCode, backLanguageCode]);

  return (
    <div
      className={cn(
        "flashcard-container relative w-full max-w-md mx-auto",
        className
      )}
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
              <FlashcardImage
                imageUrl={imageUrl}
                cardText={front}
                isPro={isPro}
                imageTier={imageTier}
              />
            </div>
          )}
          <div className="flex-1 flex items-center justify-center">
            <p className="text-lg font-medium text-center text-card-foreground">
              {front}
            </p>
          </div>
          {hint && (
            <p className="text-xs text-muted-foreground italic mt-4">
              Hint: {hint}
            </p>
          )}
        </div>

        {/* Back face */}
        <div className="flashcard-back rounded-2xl border border-border bg-card shadow-lg p-6 flex flex-col">
          {showImage && (
            <div className="mb-4 flex justify-center">
              <FlashcardImage
                imageUrl={imageUrl}
                cardText={front}
                isPro={isPro}
                imageTier={imageTier}
              />
            </div>
          )}
          <div className="flex-1 flex items-center justify-center">
            <p className="text-lg text-center text-card-foreground">{back}</p>
          </div>
        </div>
      </div>

      {/* Single volume button hoisted OUT of the flipping inner so it
       *  doesn't suffer from browser backface-visibility quirks (Safari
       *  + backdrop-blur was leaking the back-face button onto the
       *  front face, mirrored to top-left). It always reads whichever
       *  side is currently visible — keyed on isFlipped so VoiceButton
       *  remounts and grabs the right text/voice. */}
      <VoiceButton
        key={isFlipped ? "back" : "front"}
        text={isFlipped ? back : front}
        languageCode={isFlipped ? backLanguageCode : frontLanguageCode}
        voiceName={isFlipped ? backVoice : frontVoice}
        className="absolute top-2 right-2 z-20 bg-card/70 backdrop-blur-sm rounded-full"
      />
    </div>
  );
}
