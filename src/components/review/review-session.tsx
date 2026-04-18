"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Flashcard } from "@/components/flashcard/flashcard";
import { RatingButtons } from "./rating-buttons";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";

interface Card {
  id: string;
  front: string;
  back: string;
  imageUrl: string | null;
  hint: string | null;
  deck: { id: string; name: string; emoji: string | null; frontVoice?: string | null; backVoice?: string | null };
}

interface ReviewSessionProps {
  initialCards: Card[];
  autoFlipSeconds: number;
  /** When > 0, cards flip and advance automatically — no rating UI. */
  autoAdvanceSeconds?: number;
  orientation: "front" | "back" | "mixed";
  onComplete: (stats: ReviewStats) => void;
}

export interface ReviewStats {
  cardsReviewed: number;
  ratings: Record<number, number>;
}

export function ReviewSession({
  initialCards,
  autoFlipSeconds,
  autoAdvanceSeconds = 0,
  orientation,
  onComplete,
}: ReviewSessionProps) {
  const [cards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState<ReviewStats>({
    cardsReviewed: 0,
    ratings: { 1: 0, 3: 0, 5: 0 },
  });

  const autoFlipRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);

  const isAutoAdvance = autoAdvanceSeconds > 0;
  const currentCard = cards[currentIndex];
  const total = cards.length;
  const progress = total > 0 ? currentIndex / total : 0;

  const showBackFirst =
    orientation === "back" ||
    (orientation === "mixed" && currentCard && simpleHash(currentCard.id) % 2 === 0);

  // Auto-flip timer (flips the card when it hasn't been flipped yet)
  useEffect(() => {
    if (autoFlipSeconds > 0 && !isFlipped && !hasRated) {
      autoFlipRef.current = setTimeout(() => {
        setIsFlipped(true);
      }, autoFlipSeconds * 1000);
    }
    return () => {
      if (autoFlipRef.current) clearTimeout(autoFlipRef.current);
    };
  }, [autoFlipSeconds, isFlipped, hasRated, currentIndex]);

  // Advance to next card (shared by manual rating + auto-advance)
  const advanceCard = useCallback(
    (newStats: ReviewStats) => {
      if (currentIndex < total - 1) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
        setHasRated(false);
      } else {
        onComplete(newStats);
      }
    },
    [currentIndex, total, onComplete]
  );

  // Auto-advance timer — runs once the card is flipped, skips rating UI
  useEffect(() => {
    if (!isAutoAdvance) return;
    if (!isFlipped) return;

    autoAdvanceRef.current = setTimeout(() => {
      const newStats = { ...stats, cardsReviewed: stats.cardsReviewed + 1 };
      setStats(newStats);
      advanceCard(newStats);
    }, autoAdvanceSeconds * 1000);

    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [isAutoAdvance, isFlipped, autoAdvanceSeconds, currentIndex, stats, advanceCard]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleRate = useCallback(
    async (quality: number) => {
      if (isSubmitting || hasRated || isAutoAdvance) return;
      setIsSubmitting(true);

      await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: currentCard.id, quality }),
      });

      const newStats = {
        cardsReviewed: stats.cardsReviewed + 1,
        ratings: {
          ...stats.ratings,
          [quality]: (stats.ratings[quality] || 0) + 1,
        },
      };
      setStats(newStats);
      setHasRated(true);
      setIsSubmitting(false);

      setTimeout(() => advanceCard(newStats), 500);
    },
    [currentCard, stats, isSubmitting, hasRated, isAutoAdvance, advanceCard]
  );

  useKeyboardNav({
    onFlip: handleFlip,
    onRate: isAutoAdvance ? undefined : handleRate,
    enabled: isFlipped && !hasRated,
  });

  useKeyboardNav({
    onFlip: handleFlip,
    enabled: !isFlipped && !hasRated,
  });

  if (!currentCard) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No cards to review</p>
      </div>
    );
  }

  const frontText = showBackFirst ? currentCard.back : currentCard.front;
  const backText = showBackFirst ? currentCard.front : currentCard.back;
  const frontVoiceName = showBackFirst ? currentCard.deck.backVoice : currentCard.deck.frontVoice;
  const backVoiceName = showBackFirst ? currentCard.deck.frontVoice : currentCard.deck.backVoice;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {currentCard.deck.emoji} {currentCard.deck.name}
          {isAutoAdvance && (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded">
              Auto-advance
            </span>
          )}
        </span>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {total}
        </span>
      </div>

      <Progress value={progress * 100} />

      <Flashcard
        front={frontText}
        back={backText}
        imageUrl={currentCard.imageUrl}
        hint={currentCard.hint}
        isFlipped={isFlipped}
        onFlip={handleFlip}
        frontVoice={frontVoiceName}
        backVoice={backVoiceName}
        autoPlayVoice
      />

      {/* Manual rating UI — hidden in auto-advance mode */}
      {!isAutoAdvance && isFlipped && !hasRated && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground text-center">
            How well did you know this?
          </p>
          <RatingButtons onRate={handleRate} disabled={isSubmitting} />
          <p className="text-xs text-muted-foreground text-center">
            Keyboard: 1 = Again, 2 = Good, 3 = Easy
          </p>
        </div>
      )}

      {/* Flip hint when card hasn't been flipped yet */}
      {!isFlipped && (
        <div className="text-center">
          <Button variant="outline" onClick={handleFlip}>
            Show Answer
          </Button>
        </div>
      )}

      {/* Auto-advance status when card is flipped */}
      {isAutoAdvance && isFlipped && (
        <p className="text-xs text-muted-foreground text-center">
          Moving to next card in {autoAdvanceSeconds.toFixed(1)}s…
        </p>
      )}
    </div>
  );
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
