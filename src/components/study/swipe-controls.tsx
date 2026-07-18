"use client";

import { Button } from "@/components/ui/button";

interface SwipeControlsProps {
  /** Marks the card known (SM-2 quality 3 → interval grows). */
  onKnow: () => void;
  /** Marks the card unknown (SM-2 quality 1 → resets, comes back soon). */
  onDontKnow: () => void;
  disabled?: boolean;
}

/**
 * Two-choice control row that mirrors the swipe gesture for anyone on a
 * desktop / trackpad or who'd rather tap than drag. Left = don't know
 * (red), right = know it (green) — the same directions as the swipe, so
 * the muscle memory carries over. Arrow keys are wired in the parent.
 */
export function SwipeControls({ onKnow, onDontKnow, disabled }: SwipeControlsProps) {
  return (
    <div className="w-full space-y-2">
      <p className="text-center text-sm text-muted-foreground">
        Swipe, tap, or use ← → keys
      </p>
      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          onClick={onDontKnow}
          disabled={disabled}
          className="flex-1 max-w-[160px] h-12 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          <span className="mr-1 text-lg leading-none">←</span>
          <span className="font-semibold">Don&apos;t know</span>
        </Button>
        <Button
          variant="outline"
          onClick={onKnow}
          disabled={disabled}
          className="flex-1 max-w-[160px] h-12 border-green-300 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
        >
          <span className="font-semibold">Know it</span>
          <span className="ml-1 text-lg leading-none">→</span>
        </Button>
      </div>
    </div>
  );
}
