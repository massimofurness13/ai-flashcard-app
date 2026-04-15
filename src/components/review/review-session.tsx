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
  deck: { id: string; name: string; emoji: string | null };
}

interface ReviewSessionProps {
  initialCards: Card[];
  autoFlipSeconds: number;
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

  const autoFlipRef = useRef<NodeJS.Timeout>(null);

  const currentCard = cards[currentIndex];
  const total = cards.length;
  const progress = total > 0 ? ((currentIndex) / total) * 100 : 0;

  // Determine if this card should show front or back first
  const showBackFirst =
    orientation === "back" ||
    (orientation === "mixed" && currentCard && simpleHash(currentCard.id) % 2 === 0);

  // Auto-flip timer
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

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleRate = useCallback(
    async (quality: number) => {
      if (isSubmitting || hasRated) return;
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

      // Auto-advance after a brief pause
      setTimeout(() => {
        if (currentIndex < total - 1) {
          setCurrentIndex((prev) => prev + 1);
          setIsFlipped(false);
          setHasRated(false);
        } else {
          onComplete(newStats);
        }
      }, 500);
    },
    [currentCard, currentIndex, total, stats, isSubmitting, hasRated, onComplete]
  );

  useKeyboardNav({
    onFlip: handleFlip,
    onRate: handleRate,
    enabled: isFlipped && !hasRated,
  });

  // Also allow flip with keyboard even when not flipped
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {currentCard.deck.emoji} {currentCard.deck.name}
        </span>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {total}
        </span>
      </div>

      <Progress value={progress} />

      <Flashcard
        front={frontText}
        back={backText}
        imageUrl={currentCard.imageUrl}
        hint={currentCard.hint}
        isFlipped={isFlipped}
        onFlip={handleFlip}
      />

      {isFlipped && !hasRated && (
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

      {!isFlipped && (
        <div className="text-center">
          <Button variant="outline" onClick={handleFlip}>
            Show Answer
          </Button>
        </div>
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
