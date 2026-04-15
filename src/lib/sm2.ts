export interface SM2State {
  easeFactor: number; // >= 1.3
  interval: number; // in days
  repetitions: number; // consecutive correct reviews
}

export interface SM2Result extends SM2State {
  nextReviewAt: Date;
}

/**
 * SM-2 spaced repetition algorithm.
 *
 * @param quality - 1 (Again), 3 (Good), or 5 (Easy)
 * @param current - The card's current SM-2 state.
 * @returns Updated SM-2 state with the next review date.
 */
export function sm2(quality: number, current: SM2State): SM2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let { easeFactor, interval, repetitions } = current;

  if (q < 3) {
    // Failed recall: reset
    repetitions = 0;
    interval = 1;
  } else {
    // Successful recall
    repetitions += 1;

    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);
  nextReviewAt.setHours(0, 0, 0, 0);

  return {
    easeFactor: Math.round(easeFactor * 100) / 100,
    interval,
    repetitions,
    nextReviewAt,
  };
}

export function defaultSM2State(): SM2State {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
  };
}

/**
 * Calculate mastery level 0-100 from SM-2 state.
 */
export function masteryLevel(state: SM2State): number {
  if (state.repetitions === 0) return 0;
  if (state.repetitions === 1) return 20;
  if (state.repetitions === 2) return 40;

  const efScore = Math.min((state.easeFactor - 1.3) / (2.5 - 1.3), 1);
  const repScore = Math.min(state.repetitions / 8, 1);
  return Math.round(40 + 60 * (efScore * 0.4 + repScore * 0.6));
}

export type LetterGrade = "A" | "B" | "C" | "D" | "F" | "New";

/**
 * Convert mastery percentage (0-100) to a letter grade.
 */
export function letterGrade(mastery: number): LetterGrade {
  if (mastery === 0) return "New";
  if (mastery >= 90) return "A";
  if (mastery >= 75) return "B";
  if (mastery >= 60) return "C";
  if (mastery >= 40) return "D";
  return "F";
}

export function gradeColor(grade: LetterGrade): string {
  switch (grade) {
    case "A": return "#22c55e";
    case "B": return "#3b82f6";
    case "C": return "#eab308";
    case "D": return "#f97316";
    case "F": return "#ef4444";
    case "New": return "#94a3b8";
  }
}
