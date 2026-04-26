"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownWheelProps {
  /** Total duration of the countdown in seconds. */
  seconds: number;
  /** Any value that changes when the countdown should reset to full
   *  and start over (e.g. card identity + flipped side). */
  runId: string | number;
  /** Fires once the countdown reaches zero. */
  onComplete: () => void;
  /** When false the wheel is paused — interval stops, drain freezes
   *  in place. Going false → true resumes from the same offset, NOT
   *  from full. The only thing that resets to full is a runId change. */
  active?: boolean;
  className?: string;
}

const RADIUS = 16;
const CIRC = 2 * Math.PI * RADIUS;

/**
 * Visible auto-advance countdown: a circle that drains over `seconds`
 * with the remaining whole number inside.
 *
 * The drain is driven entirely by the JS tick (no CSS transition) so
 * pause/resume works exactly as you'd expect — the offset freezes at
 * the moment `active` flips to false, then continues from there when
 * it flips back to true. We track elapsed time across pauses by
 * remembering the wall-clock at start and adjusting on resume.
 */
export function CountdownWheel({
  seconds,
  runId,
  onComplete,
  active = true,
  className,
}: CountdownWheelProps) {
  const [elapsed, setElapsed] = useState(0);

  // Latest onComplete in a ref so we don't restart the timer when the
  // parent passes a new arrow function.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Reset elapsed-time state when the runId changes (new card / side).
  // Setting state inside an effect callback is needed here because
  // we need to react to a parent-controlled prop change.
  const lastRunIdRef = useRef(runId);
  useEffect(() => {
    if (lastRunIdRef.current !== runId) {
      lastRunIdRef.current = runId;
      setElapsed(0);
    }
  }, [runId]);

  // Tick every 50ms while active. Resume math: remember wall-clock
  // start each time we (re)enter the active phase, and treat the
  // already-elapsed time as a head start.
  useEffect(() => {
    if (!active) return;
    const headStart = elapsed;
    const startedAt = Date.now();
    let fired = false;
    const id = setInterval(() => {
      const total = headStart + (Date.now() - startedAt) / 1000;
      const next = Math.min(total, seconds);
      setElapsed(next);
      if (next >= seconds && !fired) {
        fired = true;
        clearInterval(id);
        onCompleteRef.current?.();
      }
    }, 50);
    return () => clearInterval(id);
    // We INTENTIONALLY exclude `elapsed` here — it's the head-start
    // captured at effect start. Including it would restart the timer
    // every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, runId, seconds]);

  const remaining = Math.max(0, seconds - elapsed);
  const offset = CIRC * Math.min(1, elapsed / seconds);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: 56, height: 56 }}
      aria-label={`${Math.ceil(remaining)} seconds remaining`}
      role="timer"
    >
      <svg width={56} height={56} viewBox="0 0 40 40" className="-rotate-90">
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeWidth="3"
        />
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
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-medium tabular-nums text-foreground">
        {Math.ceil(remaining)}
      </span>
    </div>
  );
}
