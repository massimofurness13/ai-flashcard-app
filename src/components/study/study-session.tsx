"use client";

import { useState, useCallback } from "react";
import { Flashcard } from "@/components/flashcard/flashcard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";

interface Card {
  id: string;
  front: string;
  back: string;
  imageUrl: string | null;
  hint: string | null;
}

interface StudySessionProps {
  cards: Card[];
  deckName: string;
  frontVoice?: string | null;
  backVoice?: string | null;
  onComplete?: () => void;
}

export function StudySession({ cards, deckName, frontVoice, backVoice, onComplete }: StudySessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);

  const currentCard = cards[currentIndex];
  const progress = ((currentIndex + 1) / cards.length) * 100;

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      setCompleted(true);
    }
  }, [currentIndex, cards.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  useKeyboardNav({
    onFlip: handleFlip,
    onNext: handleNext,
    onPrev: handlePrev,
    enabled: !completed,
  });

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-5xl mb-4">{"\ud83c\udf89"}</span>
        <h2 className="text-2xl font-bold">Study Complete!</h2>
        <p className="text-muted-foreground mt-2">
          You reviewed all {cards.length} cards in {deckName}
        </p>
        <div className="flex gap-3 mt-6">
          <Button
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
              setCompleted(false);
            }}
          >
            Study Again
          </Button>
          <Button variant="outline" onClick={onComplete}>
            Back to Deck
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{deckName}</h2>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      <Progress value={progress} />

      <Flashcard
        front={currentCard.front}
        back={currentCard.back}
        imageUrl={currentCard.imageUrl}
        hint={currentCard.hint}
        isFlipped={isFlipped}
        onFlip={handleFlip}
        frontVoice={frontVoice}
        backVoice={backVoice}
      />

      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </Button>
        <Button variant="outline" onClick={handleFlip}>
          Flip
        </Button>
        <Button
          variant="outline"
          onClick={handleNext}
        >
          {currentIndex === cards.length - 1 ? "Finish" : "Next"}
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Keyboard: Space to flip, Arrow keys to navigate
      </p>
    </div>
  );
}
