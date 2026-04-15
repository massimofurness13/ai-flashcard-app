export type CardOrientation = "front" | "back" | "mixed";

export interface ReviewSessionConfig {
  deckIds: string[];
  cardsPerSession: number;
  autoFlipSeconds: number;
  orientation: CardOrientation;
}

export interface StudyStats {
  totalCards: number;
  cardsDueToday: number;
  averageMastery: number;
  reviewStreak: number;
  cardsReviewedToday: number;
}

export interface DeckWithCounts {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    cards: number;
  };
  dueCount: number;
  masteryPercent: number;
}

export interface GeneratedCard {
  front: string;
  back: string;
  hint?: string;
}
