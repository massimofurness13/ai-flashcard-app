"use client";

import { useState, useCallback, useRef } from "react";
import { Flashcard } from "@/components/flashcard/flashcard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";

function shuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface Card {
  id: string;
  front: string;
  back: string;
  imageUrl: string | null;
  hint: string | null;
}

type Orientation = "front" | "back" | "mixed";

interface StudySessionProps {
  cards: Card[];
  deckName: string;
  frontVoice?: string | null;
  backVoice?: string | null;
  onComplete?: () => void;
}

function randomBackFirst(count: number, orientation: Orientation): boolean[] {
  if (orientation === "back") return Array(count).fill(true);
  if (orientation === "front") return Array(count).fill(false);
  return Array.from({ length: count }, () => Math.random() < 0.5);
}

export function StudySession({ cards, deckName, frontVoice, backVoice, onComplete }: StudySessionProps) {
  // Shuffle cards on initial render (and each "Study Again")
  const shuffledRef = useRef(shuffle(cards));
  const [shuffledCards, setShuffledCards] = useState(shuffledRef.current);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>("front");
  const [showSettings, setShowSettings] = useState(false);
  // Pre-compute each card's initial side — resampled when shuffle or orientation changes.
  // Mixed mode thus arranges the pack once and never flashes mid-session.
  const [showBackFirstPerCard, setShowBackFirstPerCard] = useState<boolean[]>(() =>
    randomBackFirst(shuffledRef.current.length, "front")
  );

  const currentCard = shuffledCards[currentIndex];
  const progress = ((currentIndex + 1) / shuffledCards.length) * 100;
  const showBackFirst = showBackFirstPerCard[currentIndex] ?? false;

  const displayFront = showBackFirst ? currentCard.back : currentCard.front;
  const displayBack = showBackFirst ? currentCard.front : currentCard.back;
  const displayFrontVoice = showBackFirst ? backVoice : frontVoice;
  const displayBackVoice = showBackFirst ? frontVoice : backVoice;

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < shuffledCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      setCompleted(true);
    }
  }, [currentIndex, shuffledCards.length]);

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
          You reviewed all {shuffledCards.length} cards in {deckName}
        </p>
        <div className="flex gap-3 mt-6">
          <Button
            onClick={() => {
              const reshuffled = shuffle(cards);
              setShuffledCards(reshuffled);
              setShowBackFirstPerCard(randomBackFirst(reshuffled.length, orientation));
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {shuffledCards.length}
          </span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Study settings"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <p className="text-sm font-medium">Card Orientation</p>
          <div className="flex gap-2">
            {([
              { value: "front" as const, label: "Front first" },
              { value: "back" as const, label: "Back first" },
              { value: "mixed" as const, label: "Random" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setOrientation(opt.value);
                  setShowBackFirstPerCard(randomBackFirst(shuffledCards.length, opt.value));
                  setIsFlipped(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  orientation === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Progress value={progress} />

      <Flashcard
        front={displayFront}
        back={displayBack}
        imageUrl={currentCard.imageUrl}
        hint={showBackFirst ? null : currentCard.hint}
        isFlipped={isFlipped}
        onFlip={handleFlip}
        frontVoice={displayFrontVoice}
        backVoice={displayBackVoice}
        autoPlayVoice
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
          {currentIndex === shuffledCards.length - 1 ? "Finish" : "Next"}
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
