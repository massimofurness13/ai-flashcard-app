"use client";

import { useEffect } from "react";

interface KeyboardNavOptions {
  onFlip?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onRate?: (quality: number) => void;
  enabled?: boolean;
}

export function useKeyboardNav({
  onFlip,
  onNext,
  onPrev,
  onRate,
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
        case "Digit1":
        case "Numpad1":
          event.preventDefault();
          onRate?.(1); // Again
          break;
        case "Digit2":
        case "Numpad2":
          event.preventDefault();
          onRate?.(3); // Good
          break;
        case "Digit3":
        case "Numpad3":
          event.preventDefault();
          onRate?.(5); // Easy
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFlip, onNext, onPrev, onRate, enabled]);
}
