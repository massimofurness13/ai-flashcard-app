"use client";

import { useEffect, useState } from "react";

/**
 * Miniature flashcard mockup used in the first-time welcome flow.
 * Auto-flips between front and back every few seconds so a brand-
 * new user gets to see the actual study experience without
 * clicking anything.
 *
 * Renders against the same design tokens as the real Flashcard
 * component (rounded-2xl, border, shadow-lg, bg-card) so it stays
 * in sync with the live UI when the design system changes.
 */
export interface MiniCardData {
  front: string;
  back: string;
  imageUrl?: string | null;
  frontLang?: string;
  backLang?: string;
}

interface MiniCardPreviewProps {
  card: MiniCardData;
  /** Override the auto-flip interval (ms). Default 3500. */
  flipMs?: number;
  className?: string;
}

export function MiniCardPreview({
  card,
  flipMs = 3500,
  className,
}: MiniCardPreviewProps) {
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setShowBack((prev) => !prev), flipMs);
    return () => clearInterval(id);
  }, [flipMs]);

  const text = showBack ? card.back : card.front;
  const lang = showBack ? card.backLang : card.frontLang;
  const sideLabel = showBack ? "Back" : "Front";

  return (
    <div className={`w-full max-w-xs mx-auto ${className ?? ""}`}>
      <div className="relative rounded-2xl border border-border bg-card shadow-lg p-4 sm:p-5 flex flex-col aspect-[4/5]">
        {/* Side indicator (top-left) — like a deck of cards numbered
         *  for clarity, not decoration. */}
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>{sideLabel}</span>
          {lang && <span className="text-foreground/70">{lang}</span>}
        </div>

        {/* Image */}
        {card.imageUrl && (
          <div className="my-3 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.imageUrl}
              alt=""
              className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl object-cover border border-border"
            />
          </div>
        )}

        {/* Text */}
        <div className="flex-1 flex items-center justify-center">
          <p
            key={text /* re-mounts on flip so the fade kicks in */}
            className="text-base sm:text-lg font-medium text-center text-card-foreground leading-snug animate-mini-fade"
          >
            {text}
          </p>
        </div>

        {/* Tiny dot pair under the card — visual rhythm cue, also
         *  signals "two sides exist". */}
        <div className="flex items-center justify-center gap-1.5 pt-3">
          <span
            className={`h-1.5 rounded-full transition-all ${
              !showBack ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
            }`}
          />
          <span
            className={`h-1.5 rounded-full transition-all ${
              showBack ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
            }`}
          />
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        Tap to flip · auto-plays audio
      </p>
    </div>
  );
}
