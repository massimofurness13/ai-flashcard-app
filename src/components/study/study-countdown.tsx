"use client";

import { useEffect, useRef, useState } from "react";
import { preloadAudio, unlockAudio } from "@/lib/tts";
import { fallbackVoiceCodes } from "@/lib/language-codes";

interface CountdownCard {
  front: string;
  back: string;
  deck: {
    frontLanguageCode?: string | null;
    backLanguageCode?: string | null;
  };
}

interface StudyCountdownProps {
  /** The session's cards, in order. We preload audio for the first
   *  few so the opening cards play with zero delay. */
  cards: CountdownCard[];
  /** Onboarding learning language — the voice fallback for decks
   *  with no explicit language code. */
  learningLanguage: string | null;
  /** Fired when the countdown reaches zero OR the user taps to skip. */
  onComplete: () => void;
}

// How many upcoming cards' audio to warm during the countdown. The
// in-session VoicePreloader keeps going after this, but warming the
// first few here is what removes the "wait a beat on card 1" lag.
// Bumped 4 → 6 so a fresh pack (where every clip generates on first
// play) has more of the opening ready before the user starts flipping.
const PRELOAD_COUNT = 6;
// Seconds in the get-ready countdown. Long enough to warm the first
// clips on a typical connection, short enough not to feel like a
// chore. Also doubles as a "prepare yourself" beat before studying.
const COUNTDOWN_FROM = 3;

/**
 * A "Get ready… 3 · 2 · 1" gate shown between loading the session's
 * cards and starting it. Two jobs:
 *   1. UX — a calm beat to prepare, framed as part of the ritual.
 *   2. Hidden work — preloads the first few cards' TTS audio so the
 *      session opens instantly instead of the user staring at card 1
 *      waiting for sound.
 *
 * Tappable to skip — the tap is also a user gesture, which warms the
 * browser's autoplay permission for the audio element, so skipping
 * doesn't cost you the first clip.
 */
export function StudyCountdown({
  cards,
  learningLanguage,
  onComplete,
}: StudyCountdownProps) {
  const [count, setCount] = useState(COUNTDOWN_FROM);
  // Guard so a tap-to-skip + the natural tick-to-zero don't both
  // fire onComplete.
  const doneRef = useRef(false);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  }

  // Tap-to-skip path. The tap is a fresh user gesture, so re-unlock
  // audio here too — covers the case where the entry tap's unlock
  // somehow didn't take (e.g. the user reached the session by a
  // route that didn't call unlockAudio).
  function skip() {
    unlockAudio();
    finish();
  }

  // Preload the opening cards' audio once on mount.
  useEffect(() => {
    const fallback = fallbackVoiceCodes(learningLanguage);
    for (const c of cards.slice(0, PRELOAD_COUNT)) {
      const front = c.deck.frontLanguageCode || fallback.front;
      const back = c.deck.backLanguageCode || fallback.back;
      if (front && c.front) void preloadAudio(c.front, front);
      if (back && c.back) void preloadAudio(c.back, back);
    }
  }, [cards, learningLanguage]);

  // Tick down once per second, then finish.
  useEffect(() => {
    if (count <= 0) {
      finish();
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // finish is stable enough for this purpose; tying it into deps
    // would re-arm the timer on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return (
    <button
      type="button"
      onClick={skip}
      className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-6 text-center"
      aria-label="Get ready — tap to start now"
    >
      <p className="label-caps text-muted-foreground">Get ready</p>
      <div
        key={count}
        className="font-editorial text-8xl font-medium text-foreground tabular-nums animate-[count-pop_0.4s_ease-out]"
      >
        {count > 0 ? count : "Go"}
      </div>
      <p className="text-xs text-muted-foreground">Tap anywhere to start now</p>
    </button>
  );
}
