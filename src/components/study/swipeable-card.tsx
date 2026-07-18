"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";

// Press has to travel this far before we treat it as a drag rather
// than a tap — keeps a tap-to-flip from being read as a micro-swipe.
const SLOP = 8;
// Release past this = commit a grade (fly the card off-screen).
const DECIDE_THRESHOLD = 110;
// Release past this on the FRONT = reveal the answer. Lower than the
// grade threshold: flipping is a lighter action than voting.
const REVEAL_THRESHOLD = 55;
// Pre-flip drags are damped so a reveal-swipe feels distinctly softer
// than a grade-swipe (the card resists rather than flinging).
const REVEAL_DAMP = 0.32;
// Max tilt (deg) at a full swipe — the Tinder-style lean.
const MAX_ROTATE = 14;
// How long the fly-off animation runs before we tell the parent to
// advance. Keep in sync with the transition duration below.
const EXIT_MS = 190;

interface SwipeableCardProps {
  children: ReactNode;
  /** Answer is showing — left/right swipes grade the card. */
  canGrade: boolean;
  /** Front is showing — a swipe (either direction) reveals the answer.
   *  No grading is possible in this state, by design. */
  canReveal: boolean;
  /** Swiped right on the answer — "I knew it". */
  onSwipeRight: () => void;
  /** Swiped left on the answer — "I didn't know it". */
  onSwipeLeft: () => void;
  /** Swiped (or the parent's tap) on the front — flip to the answer. */
  onReveal: () => void;
}

/**
 * Tinder-style swipe wrapper around a flashcard, with a two-stage
 * gesture model:
 *
 *   Front (canReveal)  — a swipe in EITHER direction flips the card to
 *                        reveal the answer. The drag is damped and shows
 *                        no green/red stamp: you can't vote on a card you
 *                        haven't turned over.
 *   Answer (canGrade)  — swipe right = known (green), left = unknown
 *                        (red); a committed swipe flies the card off and
 *                        advances, a short one springs back.
 *
 * Works with mouse, touch, and pen via Pointer Events. A tap (no drag)
 * falls through to the child's onClick so tap-to-flip still works; a real
 * drag has its click suppressed so it never doubles as a flip.
 */
export function SwipeableCard({
  children,
  canGrade,
  canReveal,
  onSwipeRight,
  onSwipeLeft,
  onReveal,
}: SwipeableCardProps) {
  const [dx, setDx] = useState(0);
  const [active, setActive] = useState(false); // finger currently down

  const startX = useRef(0);
  const dxRef = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);
  const decided = useRef(false);

  const enabled = canGrade || canReveal;

  const setOffset = (v: number) => {
    dxRef.current = v;
    setDx(v);
  };

  const decide = useCallback(
    (dir: 1 | -1) => {
      if (decided.current) return;
      decided.current = true;
      dragging.current = false;
      setActive(false);
      // Fling the card clean off the screen in the swipe direction.
      const off = (typeof window !== "undefined" ? window.innerWidth : 1000) * 1.2;
      setOffset(dir * off);
      window.setTimeout(() => {
        if (dir === 1) onSwipeRight();
        else onSwipeLeft();
      }, EXIT_MS);
    },
    [onSwipeRight, onSwipeLeft],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || decided.current) return;
      // Don't hijack presses that land on a real control (the volume
      // button, links) — let them behave as taps.
      if ((e.target as HTMLElement).closest("button, a, [role='button'], input")) {
        return;
      }
      dragging.current = true;
      moved.current = false;
      startX.current = e.clientX;
      setActive(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw if the pointer is already gone —
        // harmless, the drag just won't be captured.
      }
    },
    [enabled],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const d = e.clientX - startX.current;
    if (Math.abs(d) > SLOP) moved.current = true;
    setOffset(d);
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setActive(false);
    const d = dxRef.current;
    if (canGrade && Math.abs(d) > DECIDE_THRESHOLD) {
      decide(d > 0 ? 1 : -1);
      return;
    }
    if (canReveal && Math.abs(d) > REVEAL_THRESHOLD) {
      // Reveal in place — snap back to centre and let the flip animate.
      setOffset(0);
      onReveal();
      return;
    }
    setOffset(0); // spring back to centre
  }, [canGrade, canReveal, decide, onReveal]);

  // A drag ends with a click event on the child; swallow it so a swipe
  // never doubles as a flip. A genuine tap (moved === false) passes, so
  // tap-to-flip on the front still works.
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  }, []);

  // Grade swipes track the finger 1:1; reveal swipes are damped so the
  // card visibly resists — a different feel that signals "this only
  // flips, it doesn't vote".
  const displayDx = canGrade ? dx : dx * REVEAL_DAMP;
  const rot = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, displayDx / 14));
  // Stamps only ever show while grading — never on the front.
  const knowOp = canGrade ? Math.max(0, Math.min(1, dx / DECIDE_THRESHOLD)) : 0;
  const dontOp = canGrade ? Math.max(0, Math.min(1, -dx / DECIDE_THRESHOLD)) : 0;

  return (
    <div
      className="relative select-none"
      style={{ touchAction: enabled ? "pan-y" : "auto" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
    >
      <div
        style={{
          transform: `translateX(${displayDx}px) rotate(${rot}deg)`,
          transition: active
            ? "none"
            : `transform ${EXIT_MS}ms cubic-bezier(0.2,0.6,0.2,1)`,
          willChange: "transform",
        }}
      >
        {/* "Know it" stamp — top-left, leans in as you pull right. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-4 top-6 z-30 rotate-[-16deg] rounded-xl border-4 border-green-500 px-4 py-1 text-2xl font-extrabold uppercase tracking-wider text-green-500"
          style={{ opacity: knowOp }}
        >
          Know it
        </div>
        {/* "Don't know" stamp — top-right, leans in as you pull left. */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-4 top-6 z-30 rotate-[16deg] rounded-xl border-4 border-red-500 px-4 py-1 text-2xl font-extrabold uppercase tracking-wider text-red-500"
          style={{ opacity: dontOp }}
        >
          Don&apos;t know
        </div>
        {children}
      </div>
    </div>
  );
}
