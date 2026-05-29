"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
import { fallbackVoiceCodes } from "@/lib/language-codes";

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
  imageTier: string | null;
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
  /** The user's onboarding learning language ("es", "fr", …). Used
   *  to pick a native-speaker voice for any deck that has no explicit
   *  language code, so we never drop to the robotic device voice. */
  learningLanguage?: string | null;
}

export interface StudyStats {
  cardsReviewed: number;
  ratings: Record<number, number>;
}

// Shorter deal-out animation keeps the session feeling fast. Lowered
// from 200ms to 100ms after user feedback that the gap between rating
// a card and seeing the next one's audio was noticeable.
const DEAL_OUT_MS = 100;

// Round-trip session state through sessionStorage when the user clicks
// "Edit card." Without this, navigating to the edit page and back via
// `?returnTo=` re-mounts StudySession at currentIndex=0, kicking the
// user out of their session mid-flight.
//
// Snapshot stores the FULL ordered list of card IDs the user is
// working through, plus their current position. On resume we compare
// the new fetch by SET equality (does it contain the same card IDs?)
// rather than position-sensitive `first.id + last.id`, then re-order
// the new fetch to match the saved order. That fixes a second bug
// (May 2026) where:
//   - Random filter shuffles on every fetch → different first/last
//     IDs on return → old fingerprint mismatched → resume discarded
//   - User was on card 50/200, clicked Edit, saved, came back to 0
// Set-equality + re-order survives both cases — random gets the
// same set so it matches, due gets the same set in stable order so
// it also matches.
//
// TTL guards against stale "yesterday's session" restores when the
// user returns hours later.
const STUDY_RESUME_KEY = "study-session-resume";
const STUDY_RESUME_TTL_MS = 30 * 60 * 1000;

interface StudyResumeSnapshot {
  cardIds: string[]; // ordered — drives both the set check and the re-order
  currentIndex: number;
  stats: StudyStats;
  isFlipped: boolean;
  savedAt: number;
}

/**
 * Check whether the new fetch contains the same set of cards as the
 * snapshot, regardless of order. Both arrays are expected to be
 * smallish (≤ a few hundred) so the Set construction is cheap.
 */
function sameCardSet(snapshotIds: string[], cards: Card[]): boolean {
  if (snapshotIds.length !== cards.length) return false;
  const live = new Set(cards.map((c) => c.id));
  for (const id of snapshotIds) {
    if (!live.has(id)) return false;
  }
  return true;
}

/**
 * Re-order `cards` to match the order in `snapshotIds`. Assumes
 * sameCardSet() already returned true. O(n).
 */
function reorderToMatch(snapshotIds: string[], cards: Card[]): Card[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return snapshotIds
    .map((id) => byId.get(id))
    .filter((c): c is Card => Boolean(c));
}

function readResumeSnapshot(cards: Card[]): StudyResumeSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STUDY_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudyResumeSnapshot;
    sessionStorage.removeItem(STUDY_RESUME_KEY); // consume once
    if (Date.now() - parsed.savedAt > STUDY_RESUME_TTL_MS) return null;
    if (!Array.isArray(parsed.cardIds)) return null;
    if (!sameCardSet(parsed.cardIds, cards)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function StudySession({
  initialCards,
  learningLanguage,
  autoFlipSeconds,
  autoAdvanceSeconds = 0,
  orientation,
  onComplete,
}: StudySessionProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Resolve the resume snapshot BEFORE we freeze `cards` into state.
  // If the user just came back from editing a card, the snapshot's
  // card-ID list drives both the resume check (set equality with the
  // new fetch) AND the order — we re-order `initialCards` to match
  // the saved order so currentIndex still points at the same card,
  // even if the server's filter shuffled or moved things on re-fetch.
  const resumeSnapshot = useMemo(
    () => readResumeSnapshot(initialCards),
    [initialCards],
  );
  const [cards] = useState<Card[]>(() =>
    resumeSnapshot
      ? reorderToMatch(resumeSnapshot.cardIds, initialCards)
      : initialCards,
  );
  const [currentIndex, setCurrentIndex] = useState(
    resumeSnapshot?.currentIndex ?? 0,
  );
  const [isFlipped, setIsFlipped] = useState(resumeSnapshot?.isFlipped ?? false);
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
  const [stats, setStats] = useState<StudyStats>(
    () =>
      resumeSnapshot?.stats ?? {
        cardsReviewed: 0,
        ratings: { 1: 0, 2: 0, 3: 0, 5: 0 },
      },
  );

  // Image-view entitlement drives whether AI illustrations show in
  // clear or behind a "Subscribe to view" blur. It's true for Pro
  // users AND for non-Pro users still inside their 30-day free
  // image-viewing trial. Default to true while loading so we don't
  // briefly flash the blur for an entitled user — the next quota
  // poll corrects it within ~1s if they're not actually entitled.
  const { quota } = useCreditBalance();
  const isPro = quota?.isPro ?? true;
  const canViewAiImages = quota?.canViewAiImages ?? true;


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

  // Voice fallback for decks with no explicit language code. front
  // falls back to the user's learning language (best guess for the
  // foreign side), back to English. Resolved once per render. A deck
  // that DOES have codes uses them; only the gaps get filled. This is
  // what guarantees the device voice is never used.
  const voiceFallback = useMemo(
    () => fallbackVoiceCodes(learningLanguage),
    [learningLanguage],
  );
  const effFront = (code: string | null | undefined) =>
    code || voiceFallback.front;
  const effBack = (code: string | null | undefined) =>
    code || voiceFallback.back;

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
      // Preload against the EFFECTIVE codes (deck code or fallback)
      // so the fallback-language clips are warm too — otherwise the
      // first card on a code-less deck would hit the slow path.
      const front = effFront(c.deck.frontLanguageCode);
      const back = effBack(c.deck.backLanguageCode);
      if (front && c.front) {
        items.push({ text: c.front, languageCode: front });
      }
      if (back && c.back) {
        items.push({ text: c.back, languageCode: back });
      }
    }
    return items;
    // effFront/effBack are derived from voiceFallback (stable per
    // learningLanguage); listing voiceFallback covers them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, currentIndex, voiceFallback]);

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
  // Every advance fires a POST /api/review with quality=0 — a
  // "passive view". Server logs the row so daily count, streak,
  // and pack-studied status all update, but does NOT touch the
  // card's SM-2 fields: we don't know if the user actually
  // recalled the card, so guessing "Good" would corrupt the
  // schedule. Manual mode still uses the user's explicit
  // Again/Good/Easy rating via handleRate, which DOES drive SM-2.
  const handleCountdownComplete = useCallback(() => {
    if (!isAutoAdvance || !isFlipped || dealingOut) return;
    void fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: currentCard.id, quality: 0 }),
    }).catch(() => {
      // Network blip — non-fatal. Daily count may be off by one,
      // but nothing crashes and the next review will reconcile.
    });
    const newStats = {
      ...stats,
      cardsReviewed: stats.cardsReviewed + 1,
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
    // Friendly empty state instead of the previous "No cards to
    // review" wall. The most common cause of an empty queue is
    // "everything's been reviewed in the past 6 hours" (session-
    // boundary exclusion) or "you finished today's due cards" —
    // give the user a clear next step.
    return (
      <div className="text-center py-16 space-y-3">
        <div className="text-4xl" aria-hidden>
          🎉
        </div>
        <h2 className="font-editorial text-2xl font-medium">
          Nothing to review right now
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          You&apos;ve cleared your queue. New cards become due on a
          spaced-repetition schedule — check back later, or pick
          another pack from your library.
        </p>
        <Link href="/">
          <Button>Back to home</Button>
        </Link>
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
          {/* Edit-this-card affordance — same-tab navigation so the
           *  edit page replaces the session view (timer/audio/auto-
           *  advance all stop, no background drift). On click we
           *  snapshot the session position to sessionStorage and pass
           *  the current URL as ?returnTo=, so Save in flashcard-form
           *  brings the user back to the exact same card with the same
           *  flip-state and stats. */}
          <Link
            href={(() => {
              const search = searchParams?.toString() ?? "";
              const returnTo = pathname + (search ? `?${search}` : "");
              const qp = new URLSearchParams({ returnTo });
              return `/decks/${currentCard.deck.id}/cards/${currentCard.id}/edit?${qp.toString()}`;
            })()}
            onClick={() => {
              const snapshot: StudyResumeSnapshot = {
                cardIds: cards.map((c) => c.id),
                currentIndex,
                stats,
                isFlipped,
                savedAt: Date.now(),
              };
              try {
                sessionStorage.setItem(
                  STUDY_RESUME_KEY,
                  JSON.stringify(snapshot),
                );
              } catch {
                // Quota or private mode: degrade gracefully — user
                // returns to a fresh session, same as before this fix.
              }
            }}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
            title="Edit this card"
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
          imageTier={
            currentCard.imageTier === "quick" || currentCard.imageTier === "premium"
              ? currentCard.imageTier
              : null
          }
          hint={currentCard.hint}
          isFlipped={isFlipped}
          onFlip={handleFlip}
          isPro={isPro}
          canViewAiImages={canViewAiImages}
          frontVoice={frontVoiceName}
          backVoice={backVoiceName}
          frontLanguageCode={
            showBackFirst
              ? effBack(currentCard.deck.backLanguageCode)
              : effFront(currentCard.deck.frontLanguageCode)
          }
          backLanguageCode={
            showBackFirst
              ? effFront(currentCard.deck.frontLanguageCode)
              : effBack(currentCard.deck.backLanguageCode)
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
