"use client";

import { cn } from "@/lib/utils";
import { FlashcardImage } from "./flashcard-image";
import { VoiceButton } from "./voice-button";

interface FlashcardProps {
  front: string;
  back: string;
  imageUrl?: string | null;
  hint?: string | null;
  isFlipped: boolean;
  onFlip: () => void;
  showImage?: boolean;
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
  className,
}: FlashcardProps) {
  return (
    <div
      className={cn("flashcard-container w-full max-w-md mx-auto", className)}
      style={{ minHeight: "320px" }}
    >
      <div
        className={cn("flashcard-inner cursor-pointer", isFlipped && "flipped")}
        onClick={onFlip}
        style={{ minHeight: "320px" }}
      >
        {/* Front face */}
        <div className="flashcard-front rounded-2xl border border-border bg-card shadow-lg p-6 flex flex-col">
          {showImage && (
            <div className="h-32 mb-4 rounded-lg overflow-hidden">
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
            <VoiceButton text={front} className="ml-auto" />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Tap to flip
          </p>
        </div>

        {/* Back face */}
        <div className="flashcard-back rounded-2xl border border-border bg-card shadow-lg p-6 flex flex-col">
          {showImage && (
            <div className="h-32 mb-4 rounded-lg overflow-hidden">
              <FlashcardImage imageUrl={imageUrl} cardText={front} />
            </div>
          )}
          <div className="flex-1 flex items-center justify-center">
            <p className="text-lg text-center text-card-foreground">{back}</p>
          </div>
          <div className="flex justify-end mt-4">
            <VoiceButton text={back} />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Tap to flip back
          </p>
        </div>
      </div>
    </div>
  );
}
