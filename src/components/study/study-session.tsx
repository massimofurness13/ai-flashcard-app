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

interface StudySessionProps {
  initialCards: Card[];
  autoFlipSeconds: number;
  autoAdvanceSeconds?: number;
  orientation: "front" | "back" | "mixed";
  onComplete: (stats: StudyStats) => void;
}

export interface StudyStats {
  cardsReviewed: number;
  ratings: Record<number, number>;
}

const DEAL_OUT_MS = 350;

export function StudySession({
  initialCards,
  autoFlipSeconds,
  autoAdvanceSeconds = 0,
  orientation,
  onComplete,
}: StudySessionProps) {
  const [cards] = useState(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dealingOut, setDealingOut] = useState(false);
  const [stats, setStats] = useState<StudyStats>({
    cardsReviewed: 0,
    ratings: { 1: 0, 3: 0, 5: 0 },
  });

  const autoFlipRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);

  // Pre-compute each card's initial orientation ONCE at session start.
  // Random coin flip per card in mixed mode — no mid-session recomputation,
  // no animation flash between cards.
  const [showBackFirstPerCard] = useState<boolean[]>(() =>
    initialCards.map(() => {
      if (orientation === "back") return true;
      if (orientation === "mixed") return Math.random() < 0.5;
      return false;
    })
  );

  const isAutoAdvance = autoAdvanceSeconds > 0;
  const currentCard = cards[currentIndex];
  const total = cards.length;
  const progress = total > 0 ? currentIndex / total : 0;
  const showBackFirst = showBackFirstPerCard[currentIndex];

  // Auto-flip timer
  useEffect(() => {
    if (dealingOut) return;
    if (autoFlipSeconds > 0 && !isFlipped) {
      autoFlipRef.current = setTimeout(() => {
        setIsFlipped(true);
      }, autoFlipSeconds * 1000);
    }
    return () => {
      if (autoFlipRef.current) clearTimeout(autoFlipRef.current);
    };
  }, [autoFlipSeconds, isFlipped, currentIndex, dealingOut]);

  /**
   * Deal the current card out (slide/fade) then swap in the next card
   * already arranged on its correct side — no flip-reset animation.
   */
  const dealAndAdvance = useCallback(
    (finalStats: StudyStats) => {
      setDealingOut(true);
      setTimeout(() => {
        if (currentIndex < total - 1) {
          setCurrentIndex((prev) => prev + 1);
          setIsFlipped(false);
          setDealingOut(false);
        } else {
          onComplete(finalStats);
        }
      }, DEAL_OUT_MS);
    },
    [currentIndex, total, onComplete]
  );

  // Auto-advance timer — runs once the card is flipped, skips rating UI
  useEffect(() => {
    if (!isAutoAdvance) return;
    if (!isFlipped) return;
    if (dealingOut) return;

    autoAdvanceRef.current = setTimeout(() => {
      const newStats = { ...stats, cardsReviewed: stats.cardsReviewed + 1 };
      setStats(newStats);
      dealAndAdvance(newStats);
    }, autoAdvanceSeconds * 1000);

    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [isAutoAdvance, isFlipped, autoAdvanceSeconds, currentIndex, stats, dealAndAdvance, dealingOut]);

  const handleFlip = useCallback(() => {
    if (dealingOut) return;
    setIsFlipped((prev) => !prev);
  }, [dealingOut]);

  const handleRate = useCallback(
    async (quality: number) => {
      if (isSubmitting || dealingOut || isAutoAdvance) return;
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
      setIsSubmitting(false);
      dealAndAdvance(newStats);
    },
    [currentCard, stats, isSubmitting, dealingOut, isAutoAdvance, dealAndAdvance]
  );

  useKeyboardNav({
    onFlip: handleFlip,
    onRate: isAutoAdvance ? undefined : handleRate,
    enabled: isFlipped && !dealingOut,
  });

  useKeyboardNav({
    onFlip: handleFlip,
    enabled: !isFlipped && !dealingOut,
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

      <div className={dealingOut ? "flashcard-deal-out" : "flashcard-enter"} key={currentCard.id}>
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
      </div>

      {/* Single action area — either Show Answer OR rating, never both */}
      <div className="min-h-[80px] flex items-start justify-center">
        {!isFlipped && !dealingOut && (
          <Button variant="outline" onClick={handleFlip}>
            Show Answer
          </Button>
        )}

        {!isAutoAdvance && isFlipped && !dealingOut && (
          <div className="space-y-2 w-full">
            <p className="text-sm text-muted-foreground text-center">
              How well did you know this?
            </p>
            <RatingButtons onRate={handleRate} disabled={isSubmitting} />
            <p className="text-xs text-muted-foreground text-center">
              Keyboard: 1 = Again, 2 = Good, 3 = Easy
            </p>
          </div>
        )}

        {isAutoAdvance && isFlipped && !dealingOut && (
          <p className="text-xs text-muted-foreground text-center">
            Next card in {autoAdvanceSeconds.toFixed(1)}s…
          </p>
        )}
      </div>
    </div>
  );
}
