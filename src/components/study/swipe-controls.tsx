"use client";

import { Button } from "@/components/ui/button";

interface SwipeControlsProps {
  /** Marks the card known (SM-2 quality 3 → interval grows). */
  onKnow: () => void;
  /** Marks the card unknown (SM-2 quality 1 → resets, comes back soon). */
  onDontKnow: () => void;
  onKindOf: () => void;
  disabled?: boolean;
}

/**
 * Two-choice control row that mirrors the swipe gesture for anyone on a
 * desktop / trackpad or who'd rather tap than drag. Left = don't know
 * (red), right = know it (green) — the same directions as the swipe, so
 * the muscle memory carries over. Arrow keys are wired in the parent.
 */
export function SwipeControls({ onKnow, onDontKnow, onKindOf, disabled }: SwipeControlsProps) {
  return (
    <div className="w-full" role="group" aria-label="How well did you recall it?">
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          onClick={onDontKnow}
          disabled={disabled}
          className="min-w-0 flex-1 max-w-[160px] h-12 px-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          <span className="font-semibold">Don&apos;t know</span>
        </Button>
        <Button variant="outline" onClick={onKindOf} disabled={disabled}
          className="min-w-0 flex-1 max-w-[160px] h-12 px-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950">
          <span className="font-semibold">Kind of</span>
        </Button>
        <Button
          variant="outline"
          onClick={onKnow}
          disabled={disabled}
          className="min-w-0 flex-1 max-w-[160px] h-12 px-2 border-green-300 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
        >
          <span className="font-semibold">Secure</span>
        </Button>
      </div>
    </div>
  );
}
