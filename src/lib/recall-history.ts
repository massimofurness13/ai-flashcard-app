type RecallHistory = {
  reviews: { quality: number; reviewedAt: Date }[];
  recallStates: { lastQuality: number; lastReviewedAt: Date }[];
};

/** ReviewLog is the authority, including historical ratings with no direction.
 * Direction snapshots are only a fallback when no review log is available. */
export function latestRecallQualities(card: RecallHistory, limit = 2): number[] {
  const graded = card.reviews.filter(e => e.quality > 0);
  const events = graded.length ? graded : card.recallStates.map(s => ({ quality: s.lastQuality, reviewedAt: s.lastReviewedAt }));
  return events.filter(e => e.quality > 0).slice()
    .sort((a,b) => b.reviewedAt.getTime()-a.reviewedAt.getTime() || a.quality-b.quality)
    .slice(0,limit).map(e => e.quality);
}

/** Latest graded attempt moved a previously retained card back into learning. */
export function justLostRetention(card: RecallHistory): boolean {
  const [latest, previous, earlier] = latestRecallQualities(card, 3);
  const wasRetained = previous >= 3 || (previous === 2 && earlier >= 3);
  return !isRetentionCard(card) && wasRetained && (latest === 1 || latest === 2);
}

/** Secure promotes; one partial recall gets a retention retry, two demote.
 * An outright failure demotes immediately. Passive views never promote. */
export function isRetentionCard(card: RecallHistory): boolean {
  const [latest, previous] = latestRecallQualities(card);
  return latest >= 3 || (latest === 2 && previous >= 3);
}
