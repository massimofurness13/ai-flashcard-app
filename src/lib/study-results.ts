import { isRetentionCard } from "./recall-history";
import { dailyProgress, type DailyPick } from "./daily-study";

type Grade = { quality: number; reviewedAt: Date };
export type ResultLog = Grade & { cardId: string; direction: string | null };
export interface DailyResults {
  completed: number;
  total: number;
  promoted: number;
  returnedToLearning: number;
  retentionSecure: number;
  retentionReviewed: number;
}

/** Compare genuine history before the set with saved ratings in this set.
 * Historical binary ratings count; passive views and unreviewed cards don't.
 * Each card contributes once, even when a sync/retry supplies several logs. */
export function dailyResults(
  picks: DailyPick[],
  before: { id: string; reviews: Grade[] }[],
  logs: ResultLog[],
): DailyResults {
  const ordered = logs.slice().sort((a,b) => b.reviewedAt.getTime()-a.reviewedAt.getTime() || a.quality-b.quality);
  const progress = dailyProgress(picks, ordered);
  const unreviewed = new Set(progress.remaining.map(p => p.id));
  const byId = new Map(before.map(c => [c.id, c.reviews]));
  const result: DailyResults = { completed: progress.completed, total: progress.total, promoted: 0, returnedToLearning: 0, retentionSecure: 0, retentionReviewed: 0 };
  for (const pick of picks) {
    if (unreviewed.has(pick.id)) continue;
    const prior = byId.get(pick.id) ?? [];
    const attempts = ordered.filter(l => l.cardId === pick.id && l.quality > 0);
    const wasRetained = isRetentionCard({ reviews: prior, recallStates: [] });
    const nowRetained = isRetentionCard({ reviews: [...attempts, ...prior], recallStates: [] });
    if (!wasRetained && nowRetained) result.promoted++;
    if (wasRetained && !nowRetained) result.returnedToLearning++;
    if (wasRetained) {
      result.retentionReviewed++;
      if (attempts.find(l => l.direction === pick.studyDirection)!.quality >= 3) result.retentionSecure++;
    }
  }
  return result;
}
