"use client";

import Link from "next/link";
import { useState, useCallback, useMemo } from "react";
import { Flashcard } from "@/components/flashcard/flashcard";
import { RatingButtons } from "./rating-buttons";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { ImagePreloader } from "./image-preloader";
import { VoicePreloader, type VoicePreloadItem } from "./voice-preloader";
import { useCreditBalance } from "@/components/subscription/credit-balance";
import { CountdownWheel } from "./countdown-wheel";

const PRELOAD_AHEAD = 5;
// Voice preload window is tighter than image preload (3 vs 5) because
// each TTS call costs real money on first generation — we want to warm
// only the cards the user is very likely to reach. Once cached, they're
// free forever so this only matters for brand-new content.
const VOICE_PRELOAD_AHEAD = 3;

interface Card {
  id: string;
  front: string;
  back: string;
  imageUrl: string | null;
  hint: string | null;
  deck: {
    id: string;
    name: string;
    emoji: string | null;
    frontVoice?: string | null;
    backVoice?: string | null;
    frontLanguageCode?: string | null;
    backLanguageCode?: string | null;
  };
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

// Shorter deal-out animation keeps the session feeling fast. Longer
// than this reads as sluggish; shorter than ~150ms reads as a glitch.
const DEAL_OUT_MS = 200;

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
  // Tracks which (card-id, side) combination has finished playing
  // its TTS clip. Storing the identity rather than a boolean lets us
  // implicitly "reset" when the user changes card or flips — a stale
  // entry simply won't match the current key, so audioFinished
  // becomes false without any effect-driven setState.
  const [lastAudioKey, setLastAudioKey] = useState<string | null>(null);
  // User-facing pause: freezes the countdown wheel and cancels any
  // in-flight audio. Resume picks up from the same offset.
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState<StudyStats>({
    cardsReviewed: 0,
    ratings: { 1: 0, 3: 0, 5: 0 },
  });

  // Pro status drives whether AI illustrations show in clear or
  // behind a "Resubscribe to view" blur. Hook is shared with the
  // credits pill / quota checks so only one /api/images/quota fetch
  // happens during the session. Default to true while loading so we
  // don't briefly flash the blur on an active Pro user.
  const { quota } = useCreditBalance();
  const isPro = quota?.isPro ?? true;


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

  // Identifies the audio currently expected to be playing. The
  // Flashcard fires onAudioEnd, we stamp this key into lastAudioKey,
  // and audioFinished becomes true. Changing card/side automatically
  // produces a new key, so the gate resets without any reset effect.
  const currentAudioKey = currentCard
    ? `${currentCard.id}:${isFlipped ? "back" : "front"}`
    : "";
  const audioFinished = lastAudioKey === currentAudioKey;

  // Preload the next N card images so the user never sees a blank image
  // when they advance. Memoized by index so the ref-based dedupe inside
  // ImagePreloader only sees new URLs as the session progresses.
  const upcomingImageUrls = useMemo(
    () =>
      cards
        .slice(currentIndex + 1, currentIndex + 1 + PRELOAD_AHEAD)
        .map((c) => c.imageUrl),
    [cards, currentIndex]
  );

  // Warm both the URL cache and the browser MP3 cache for the CURRENT
  // card and the next couple. Including the current card matters for
  // the first card of a session — otherwise the user hits the slow
  // network path on card #1 before the preloader has caught up.
  // After that, ref-based dedupe inside VoicePreloader means we only
  // fetch each pair once.
  const upcomingVoiceItems = useMemo<VoicePreloadItem[]>(() => {
    const items: VoicePreloadItem[] = [];
    const slice = cards.slice(currentIndex, currentIndex + VOICE_PRELOAD_AHEAD + 1);
    for (const c of slice) {
      if (c.deck.frontLanguageCode && c.front) {
        items.push({ text: c.front, languageCode: c.deck.frontLanguageCode });
      }
      if (c.deck.backLanguageCode && c.back) {
        items.push({ text: c.back, languageCode: c.deck.backLanguageCode });
      }
    }
    return items;
  }, [cards, currentIndex]);

  // Auto-flip is driven by the CountdownWheel's onComplete in the JSX
  // below — same pattern as auto-advance. The wheel itself only ticks
  // while audioFinished is true, so the timer never overlaps with
  // front-side speech.

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

  // Auto-advance is triggered by the visible CountdownWheel below
  // hitting zero — NOT by a setTimeout here. The wheel only starts
  // ticking when both `isFlipped` and `audioFinished` are true, which
  // means the back-side audio has already played to completion. This
  // is the user's requested ordering: flip → audio → countdown →
  // advance, with no overlap.
  //
  // Every advance fires a POST /api/review with quality=3 ("Good")
  // — fire-and-forget, doesn't block the UI. Without this, passive
  // study sessions in auto-advance mode never recorded anything:
  // no daily count, no streak update, no SM-2 progression. Treating
  // each viewed card as a passing recall is the right default
  // because the user sat through the audio, saw both sides, and
  // didn't actively rate it as "Again". Manual mode still uses the
  // user's explicit Again/Good/Easy rating in handleRate.
  const handleCountdownComplete = useCallback(() => {
    if (!isAutoAdvance || !isFlipped || dealingOut) return;
    void fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: currentCard.id, quality: 3 }),
    }).catch(() => {
      // Network blip — non-fatal. Daily count may be off by one,
      // but nothing crashes and the next review will reconcile.
    });
    const newStats = {
      ...stats,
      cardsReviewed: stats.cardsReviewed + 1,
      ratings: {
        ...stats.ratings,
        3: (stats.ratings[3] || 0) + 1,
      },
    };
    setStats(newStats);
    dealAndAdvance(newStats);
  }, [isAutoAdvance, isFlipped, dealingOut, stats, dealAndAdvance, currentCard]);

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
      <ImagePreloader urls={upcomingImageUrls} />
      <VoicePreloader items={upcomingVoiceItems} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground truncate">
          {currentCard.deck.emoji} {currentCard.deck.name}
          {isAutoAdvance && (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded">
              Auto-advance
            </span>
          )}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {/* Edit-this-card affordance — opens in a new tab so the
           *  current study session keeps its place. The user can fix
           *  a typo or regenerate the image, save, close the tab, and
           *  carry on with the same card without losing position. */}
          <Link
            href={`/decks/${currentCard.deck.id}/cards/${currentCard.id}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
            title="Edit this card (opens in a new tab)"
            aria-label="Edit this card"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Link>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {total}
          </span>
        </div>
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
          isPro={isPro}
          frontVoice={frontVoiceName}
          backVoice={backVoiceName}
          frontLanguageCode={
            showBackFirst ? currentCard.deck.backLanguageCode : currentCard.deck.frontLanguageCode
          }
          backLanguageCode={
            showBackFirst ? currentCard.deck.frontLanguageCode : currentCard.deck.backLanguageCode
          }
          autoPlayVoice
          paused={isPaused}
          onAudioEnd={() => setLastAudioKey(currentAudioKey)}
        />
      </div>

      {/* Single action area — either Show Answer OR rating, never both */}
      <div className="min-h-[80px] flex items-start justify-center">
        {/* Pre-flip action area. The card itself is tappable to flip
         * (Flashcard's outer div has onClick={onFlip}) so we don't
         * need an explicit "Show Answer" button. When auto-flip is
         * configured we show the countdown wheel + pause; otherwise
         * the area stays empty so the user just taps when ready. */}
        {!isFlipped && !dealingOut && autoFlipSeconds > 0 && (
          <div className="flex items-center gap-2">
            <CountdownWheel
              seconds={autoFlipSeconds}
              runId={`flip:${currentCard.id}`}
              active={audioFinished && !isPaused}
              onComplete={() => setIsFlipped(true)}
            />
            <PauseToggle paused={isPaused} onToggle={() => setIsPaused((p) => !p)} />
          </div>
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
          <div className="flex items-center gap-2">
            <CountdownWheel
              seconds={autoAdvanceSeconds}
              runId={`adv:${currentCard.id}`}
              active={audioFinished && !isPaused}
              onComplete={handleCountdownComplete}
            />
            <PauseToggle paused={isPaused} onToggle={() => setIsPaused((p) => !p)} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Small icon-only button for pausing/resuming the auto-flip and
 *  auto-advance countdowns. Sits next to the wheel so the user can
 *  reach for it as soon as they want a beat to think. */
function PauseToggle({
  paused,
  onToggle,
}: {
  paused: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={paused ? "Resume" : "Pause"}
      title={paused ? "Resume" : "Pause"}
    >
      {paused ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
        </svg>
      )}
    </Button>
  );
}
