import { createEmptyCard, fsrs, Rating, type Card } from "ts-fsrs";

export interface TrialReview {
  id: string; cardId: string; direction: string | null;
  quality: number; reviewedAt: Date; interval: number;
}
export interface TrialReport {
  version: string; mode: "shadow"; reviewsReplayed: number; directions: number;
  unknownDirection: number; comparisons: number; recalls: number;
  fsrsBrier: number | null; intervalBaselineBrier: number | null;
  truncated: boolean; from: string | null; through: string | null;
}

// Kind of means incomplete recall in Huella, not FSRS Hard (correct but slow).
// Historical Good/Know it map to Good; the old Easy rating remains Easy.
export function trialRating(quality: number) {
  return quality <= 2 ? Rating.Again : quality === 5 ? Rating.Easy : Rating.Good;
}

/** Replay only. This module has no database dependency and cannot reschedule.
 * Prediction is recorded BEFORE the outcome is applied. Front/back have separate
 * memory states; old unknown-side reviews are reported, never assigned a side.
 * Paired Brier scores use >=24h gaps and a positive recorded baseline interval.
 * The baseline is an explicit 90%-at-interval heuristic, not an SM-2 probability.
 */
export function evaluateFsrsTrial(input: TrialReview[], truncated = false): TrialReport {
  const scheduler = fsrs({request_retention:0.9,enable_fuzz:false});
  const states = new Map<string,{card:Card;previous:TrialReview}>();
  const report: TrialReport = {version:"FSRS-6 / ts-fsrs 5.4.2",mode:"shadow",reviewsReplayed:0,directions:0,unknownDirection:0,comparisons:0,recalls:0,fsrsBrier:null,intervalBaselineBrier:null,truncated,from:null,through:null};
  let fsrsError=0, baselineError=0;
  const seen = new Set<string>();
  const reviews = input.filter(r=>r.quality>=1 && r.quality<=5 && Number.isFinite(r.reviewedAt.getTime()))
    .slice().sort((a,b)=>a.reviewedAt.getTime()-b.reviewedAt.getTime() || a.id.localeCompare(b.id));
  for (const review of reviews) {
    if (seen.has(review.id)) continue;
    seen.add(review.id);
    if (review.direction!=="front" && review.direction!=="back") {report.unknownDirection++;continue;}
    const key=review.cardId+":"+review.direction;
    const previous=states.get(key);
    const card=previous?.card ?? createEmptyCard<Card>(review.reviewedAt);
    if (previous) {
      const days=(review.reviewedAt.getTime()-previous.previous.reviewedAt.getTime())/86400000;
      if (days>=1 && previous.previous.interval>0) {
        const predicted=scheduler.get_retrievability(card,review.reviewedAt,false);
        const baseline=Math.pow(0.9,days/previous.previous.interval);
        const recalled=review.quality>=3 ? 1 : 0;
        fsrsError+=(predicted-recalled)**2;
        baselineError+=(baseline-recalled)**2;
        report.comparisons++;report.recalls+=recalled;
      }
    }
    states.set(key,{card:scheduler.next(card,review.reviewedAt,trialRating(review.quality)).card,previous:review});
    report.reviewsReplayed++;
    report.from ??= review.reviewedAt.toISOString();
    report.through=review.reviewedAt.toISOString();
  }
  report.directions=states.size;
  if (report.comparisons) {
    report.fsrsBrier=fsrsError/report.comparisons;
    report.intervalBaselineBrier=baselineError/report.comparisons;
  }
  return report;
}
