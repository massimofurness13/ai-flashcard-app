import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeDate(date: Date | string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

/**
 * Rough estimate of how long image generation will take for N cards.
 * Based on measured ~10 seconds per card (Claude Haiku concept ~1.5s +
 * SDXL generation + upload ~7-8s).
 */
export function estimateImageGenTime(cardCount: number): string {
  if (cardCount <= 0) return "a moment";
  const seconds = cardCount * 10;
  if (seconds < 45) return "under a minute";
  if (seconds < 90) return "about a minute";
  const minutes = Math.round(seconds / 60);
  return `about ${minutes} minutes`;
}
