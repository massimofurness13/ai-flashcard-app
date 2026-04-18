export const APP_NAME = "FlashMind";
export const APP_DESCRIPTION = "Your personal AI study companion — master any subject with intelligent flashcards and spaced repetition";

export const CARDS_PER_SESSION_OPTIONS = [10, 25, 50, 100, 200] as const;
export const DEFAULT_CARDS_PER_SESSION = 10;

export const AUTO_FLIP_MIN = 1;
export const AUTO_FLIP_MAX = 10;
export const DEFAULT_AUTO_FLIP = 0;

export const CARD_ORIENTATION_OPTIONS = [
  { label: "Front first", value: "front" },
  { label: "Back first", value: "back" },
  { label: "Mixed", value: "mixed" },
] as const;

export const FONT_SIZE_OPTIONS = [
  { label: "Small", value: "small", class: "text-sm" },
  { label: "Medium", value: "medium", class: "text-base" },
  { label: "Large", value: "large", class: "text-lg" },
  { label: "Extra Large", value: "xlarge", class: "text-xl" },
] as const;

export const RATING_OPTIONS = [
  { value: 1, label: "Again", description: "Didn't know it", color: "text-red-500" },
  { value: 3, label: "Good", description: "Took some effort", color: "text-yellow-500" },
  { value: 5, label: "Easy", description: "Knew it instantly", color: "text-green-500" },
] as const;

export const DEFAULT_FOLDER_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#a855f7", // purple
  "#ec4899", // pink
] as const;

export const NAV_ITEMS = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Stats", href: "/stats", icon: "stats" },
  { label: "Study", href: "/study", icon: "review" },
  { label: "Account", href: "/account", icon: "account" },
] as const;
