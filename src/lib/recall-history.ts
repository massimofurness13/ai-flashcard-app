type RecallHistory = {
  reviews: { quality: number; reviewedAt: Date }[];
  recallStates: { lastQuality: number; lastReviewedAt: Date }[];
};

/** ReviewLog is the authority, including historical ratings with no direction.
 * Direction snapshots are only a fallback when no review log is available. */
export function latestRecallQualities(card: RecallHistory): number[] {
  const graded = card.reviews.filter(e => e.quality > 0);
  const events = graded.length ? graded : card.recallStates.map(s => ({ quality: s.lastQuality, reviewedAt: s.lastReviewedAt }));
  return events.filter(e => e.quality > 0).slice()
    .sort((a,b) => b.reviewedAt.getTime()-a.reviewedAt.getTime() || a.quality-b.quality)
    .slice(0,2).map(e => e.quality);
}

/** Secure promotes; one partial recall gets a retention retry, two demote.
 * An outright failure demotes immediately. Passive views never promote. */
export function isRetentionCard(card: RecallHistory): boolean {
  const [latest, previous] = latestRecallQualities(card);
  return latest >= 3 || (latest === 2 && previous >= 3);
}
