"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownWheelProps {
  /** Seconds the countdown should run for. */
  seconds: number;
  /** Any value that changes when the countdown should restart
   *  (e.g. card index + isFlipped). */
  runId: string | number;
  /** Fires once the countdown reaches zero. */
  onComplete: () => void;
  /** When false, the wheel pauses (no JS tick, no CSS animation).
   *  Used to delay the timer until audio has finished. */
  active?: boolean;
  className?: string;
}

const RADIUS = 16; // SVG units in a 40-unit viewBox
const CIRC = 2 * Math.PI * RADIUS;

/**
 * Visible auto-advance countdown: a circle that drains over `seconds`
 * with the remaining whole number inside. Restarts whenever `runId`
 * changes; pauses entirely while `active` is false.
 *
 * Drain is implemented with a CSS transition on stroke-dashoffset so
 * it stays smooth even if the JS thread is blocked. The two-phase
 * useEffect (set 0, then set CIRC on the next frame) is what makes
 * the transition fire — going straight to the final value would skip
 * the animation since the initial render IS the final state.
 */
export function CountdownWheel({
  seconds,
  runId,
  onComplete,
  active = true,
  className,
}: CountdownWheelProps) {
  // Visible "drain" value — 0 = full circle, CIRC = empty.
  // Re-keyed each run so we render at offset=0, then a single
  // requestAnimationFrame in an effect bumps to CIRC, triggering the
  // CSS transition. State is set INSIDE a callback (rAF), not in the
  // body of the effect, which keeps the lint rule happy.
  const [offset, setOffset] = useState(0);
  const [remaining, setRemaining] = useState(seconds);
  // Stash the latest onComplete in a ref so the interval below can
  // call the freshest version without rerunning when the prop changes
  // (which would restart the wheel mid-tick). Updated inside an
  // effect so we don't mutate during render.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (!active) {
      // Snap back to full when paused — reset happens via callback,
      // not synchronous setState in the effect body.
      raf1 = requestAnimationFrame(() => {
        setOffset(0);
        setRemaining(seconds);
      });
      return () => cancelAnimationFrame(raf1);
    }

    // Two-frame trick: first frame commits offset=0, second frame
    // sets offset=CIRC, which triggers the linear CSS transition.
    raf1 = requestAnimationFrame(() => {
      setOffset(0);
      setRemaining(seconds);
      raf2 = requestAnimationFrame(() => {
        setOffset(CIRC);
      });
    });

    const startedAt = Date.now();
    let fired = false;
    intervalId = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      if (left <= 0 && !fired) {
        fired = true;
        if (intervalId) clearInterval(intervalId);
        onCompleteRef.current?.();
      }
    }, 100);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (intervalId) clearInterval(intervalId);
    };
  }, [active, runId, seconds]);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: 56, height: 56 }}
      aria-label={`Auto-advancing in ${Math.ceil(remaining)} seconds`}
      role="timer"
    >
      <svg width={56} height={56} viewBox="0 0 40 40" className="-rotate-90">
        {/* Background track */}
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeWidth="3"
        />
        {/* Draining stroke */}
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{
            transition: active ? `stroke-dashoffset ${seconds}s linear` : "none",
          }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-medium tabular-nums text-foreground">
        {Math.ceil(remaining)}
      </span>
    </div>
  );
}
