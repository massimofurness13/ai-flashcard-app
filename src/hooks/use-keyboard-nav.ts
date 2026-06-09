"use client";

import { useEffect } from "react";

interface KeyboardNavOptions {
  onFlip?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  /**
   * Accepted for backwards-compat with existing call sites, but no
   * longer wired to any key. Huella is a touch-first app — rating is
   * done by tapping the Again/Hard/Good/Easy buttons, not number keys.
   */
  onRate?: (quality: number) => void;
  enabled?: boolean;
}

export function useKeyboardNav({
  onFlip,
  onNext,
  onPrev,
  enabled = true,
}: KeyboardNavOptions) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      // Ignore if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (event.code) {
        case "Space":
          event.preventDefault();
          onFlip?.();
          break;
        case "ArrowRight":
          event.preventDefault();
          onNext?.();
          break;
        case "ArrowLeft":
          event.preventDefault();
          onPrev?.();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFlip, onNext, onPrev, enabled]);
}
