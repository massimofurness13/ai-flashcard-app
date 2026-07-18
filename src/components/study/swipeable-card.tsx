"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";

// Press has to travel this far before we treat it as a drag rather
// than a tap — keeps a tap-to-flip from being read as a micro-swipe.
const SLOP = 8;
// Release past this = commit a grade (fly the card off-screen).
const DECIDE_THRESHOLD = 110;
// Max tilt (deg) at a full swipe — the Tinder-style lean.
const MAX_ROTATE = 14;
// How long the fly-off animation runs before we tell the parent to
// advance. Keep in sync with the transition duration below.
const EXIT_MS = 190;

interface SwipeableCardProps {
  children: ReactNode;
  /** Answer is showing — left/right swipes grade the card. On the front
   *  this is false, so the card isn't swipeable and every tap falls
   *  straight through to flip it (no dead zone). */
  enabled: boolean;
  /** Swiped right on the answer — "I knew it". */
  onSwipeRight: () => void;
  /** Swiped left on the answer — "I didn't know it". */
  onSwipeLeft: () => void;
}

/**
 * Tinder-style swipe wrapper around a flashcard. The interaction model:
 *
 *   Front  — NOT swipeable; a tap flips the card to reveal the answer
 *            (handled by the child's onClick, which we never intercept
 *            here while `enabled` is false).
 *   Answer — swipe right = known (green), left = unknown (red); a
 *            committed swipe flies the card off and advances, a short one
 *            springs back. A plain tap still flips back to the front.
 *
 * Works with mouse, touch, and pen via Pointer Events. A tap (no drag)
 * falls through to the child's onClick so tap-to-flip always works; a
 * real drag has its click suppressed so it never doubles as a flip.
 */
export function SwipeableCard({
  children,
  enabled,
  onSwipeRight,
  onSwipeLeft,
}: SwipeableCardProps) {
  const [dx, setDx] = useState(0);
  const [active, setActive] = useState(false); // finger currently down

  const startX = useRef(0);
  const dxRef = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);
  const decided = useRef(false);

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
    if (Math.abs(dxRef.current) > DECIDE_THRESHOLD) {
      decide(dxRef.current > 0 ? 1 : -1);
    } else {
      setOffset(0); // spring back to centre
    }
  }, [decide]);

  // A drag ends with a click event on the child; swallow it so a swipe
  // never doubles as a flip. A genuine tap (moved === false) passes, so
  // tap-to-flip always works — on the front (never intercepted) and on
  // the answer (a still tap flips back).
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  }, []);

  const rot = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, dx / 14));
  const knowOp = Math.max(0, Math.min(1, dx / DECIDE_THRESHOLD));
  const dontOp = Math.max(0, Math.min(1, -dx / DECIDE_THRESHOLD));

  return (
    <div
      className="relative select-none"
      style={{
        touchAction: enabled ? "pan-y" : "auto",
        // Kill native image/text drag-and-drop. Without this, a mouse
        // drag that starts on the card's <img> fires `dragstart`, the
        // browser enters drag-and-drop mode, and pointermove events stop
        // — so the card never follows the cursor on desktop. Cancelling
        // dragstart keeps the pointer stream flowing to our handlers.
        WebkitUserDrag: "none",
      } as React.CSSProperties}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
    >
      <div
        style={{
          transform: `translateX(${dx}px) rotate(${rot}deg)`,
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
