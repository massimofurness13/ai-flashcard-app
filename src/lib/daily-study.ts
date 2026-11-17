import { isRetentionCard, justLostRetention, latestRecallQualities } from "./recall-history";
import { toLocalDateKey } from "./timezone";
import { lastCardReviewAt, reviewDueAt, selectStudyCards, type StudyCandidate, type StudyPick } from "./study-selection";

import { DAILY_STUDY_TARGET, DAILY_RETENTION_TARGET, initialDailyAllocation, type DailyAllocation } from "./daily-allocation";
export { DAILY_STUDY_TARGET, DAILY_RETENTION_TARGET } from "./daily-allocation";
export const DAILY_LEARNING_TARGET = DAILY_STUDY_TARGET - DAILY_RETENTION_TARGET;

export const DAILY_OLDEST_RETENTION_TARGET = 20;

export type DailyPick = StudyPick & { group: "practice" | "retention" | "new"; dailyAllocation?: DailyAllocation };
export type RecallBand = "unrated" | "dont-know" | "kind-of" | "secure";

/** Read historical scores in place; passive views are never proof of recall. */
export function recallBand(quality: number | undefined): RecallBand {
  if (!quality) return "unrated";
  if (quality === 1) return "dont-know";
  if (quality === 2) return "kind-of";
  return "secure"; // Old Good / Know it / Easy all recorded successful recall.
}

/** Start 70:50, then adapt between 80:40 and 40:80. Practice precedes new cards. */
export function buildDailyPlan(cards: StudyCandidate[], now = new Date(), random: () => number = Math.random, previousPicks: DailyPick[] = [], allocation = initialDailyAllocation()): DailyPick[] {
  const retentionTarget = allocation.retentionTarget;
  const learningTarget = DAILY_STUDY_TARGET-retentionTarget;
  const practiced = cards.filter(c => c.reviews.length > 0 || c.recallStates.length > 0);
  const weak = practiced.filter(c => !isRetentionCard(c));
  const secure = practiced.filter(isRetentionCard);
  const newCards = cards.filter(c => !c.reviews.length && !c.recallStates.length);
  const byId = new Map(cards.map(c => [c.id, c]));
  const practice = selectStudyCards(weak, "mastery", "auto", now, random)
    .map(p => ({ ...p, group: "practice" as const }));
  // Reserve coverage within retention, then use the remaining slots for retries/due cards.
  // Reviewing either face moves a card to the back of the coverage rotation.
  const retentionPicks = selectStudyCards(secure, "random", "auto", now, random);
  const oldest = [...retentionPicks].sort((a,b) =>
    lastCardReviewAt(byId.get(a.id)!).getTime()-lastCardReviewAt(byId.get(b.id)!).getTime()
    || a.id.localeCompare(b.id)).slice(0, Math.min(DAILY_OLDEST_RETENTION_TARGET, retentionTarget));
  const covered = new Set(oldest.map(p => p.id));
  const scheduled = retentionPicks.filter(p => !covered.has(p.id)).sort((a,b) => {
    const retry = (p: StudyPick) => latestRecallQualities(byId.get(p.id)!)[0] === 2;
    return Number(retry(b))-Number(retry(a))
      || reviewDueAt(byId.get(a.id)!, a.studyDirection).getTime()-reviewDueAt(byId.get(b.id)!, b.studyDirection).getTime();
  });
  const retention = [...oldest, ...scheduled]
    .map(p => ({ ...p, group: "retention" as const, studyReason: "Retention" }));
  const fresh = selectStudyCards(newCards, "created", "auto", now, random)
    .map(p => ({ ...p, group: "new" as const, studyReason: "New vocabulary" }));
  const learningById = new Map([...practice, ...fresh].map(p => [p.id, p]));
  const learning: DailyPick[] = [];
  const included = new Set<string>();
  const previouslyRetained = new Set(previousPicks.filter(p => p.group === "retention").map(p => p.id));
  // A new lapse takes a learning slot before the existing cohort. The displaced
  // card remains in the practice bank; it is neither promoted nor deleted.
  const relapsed = practice.filter(p => previouslyRetained.has(p.id) || justLostRetention(byId.get(p.id)!));
  for (const pick of relapsed.slice(0, learningTarget)) {
    learning.push(pick); included.add(pick.id);
  }
  // Keep the active learning cohort across days. Only promotion, archive or
  // deletion frees a place, except for the explicit recent-lapse priority above.
  for (const previous of previousPicks) {
    const pick = learningById.get(previous.id);
    if (previous.group !== "retention" && pick && !included.has(pick.id) && learning.length < learningTarget) {
      learning.push(pick); included.add(pick.id);
    }
  }
  for (const pick of practice) {
    if (learning.length >= learningTarget) break;
    if (!included.has(pick.id)) { learning.push(pick); included.add(pick.id); }
  }
  if (learning.length < learningTarget) {
    learning.push(...fresh.filter(p => !included.has(p.id)).slice(0, learningTarget - learning.length));
  }
  // Keep the workload predictable: missing retention must not turn into extra
  // difficult/new cards. A smaller pool yields a shorter, unique-card session.
  const selected: DailyPick[] = [...retention.slice(0, retentionTarget), ...learning];
  // Interleave the chosen groups so the session does not arrive pack by pack.
  for (let i=selected.length-1;i>0;i--) {
    const j=Math.floor(random()*(i+1)); [selected[i],selected[j]]=[selected[j],selected[i]];
  }
  if (selected.length) selected[0] = {...selected[0], dailyAllocation: allocation};
  return selected;
}

export function dailyProgress(picks: DailyPick[], logs: {cardId:string;direction:string|null;quality:number}[]) {
  const grades = new Map<string,number>();
  // Callers provide newest first, so a retry/different device cannot double-count a card.
  for (const log of logs) {
    const key=log.cardId+":"+log.direction;
    if (log.quality>0 && !grades.has(key)) grades.set(key,log.quality);
  }
  const remaining: DailyPick[]=[];
  const ratings: Record<number,number>={1:0,2:0,4:0};
  for (const pick of picks) {
    const quality=grades.get(pick.id+":"+pick.studyDirection);
    if (quality===undefined) remaining.push(pick);
    else { const band=quality>=3?4:quality; ratings[band]++; }
  }
  return { remaining, completed:picks.length-remaining.length,total:picks.length,ratings };
}

export type DailyStudySummary = { day: string; timeZone: string; completed: number; total: number };

/** Ignore yesterday's device cache; count the frozen set, not unrelated/repeated reviews. */
export function dailyStudyStatus(summary?: DailyStudySummary | null, now = new Date()) {
  let current = false;
  try { current = !!summary && summary.day === toLocalDateKey(now, summary.timeZone); } catch { /* stale/invalid cache */ }
  if (!current || !summary || summary.total <= 0) return { total: DAILY_STUDY_TARGET, completed: 0, remaining: DAILY_STUDY_TARGET, finished: false };
  const completed = Math.max(0, Math.min(summary.total, summary.completed));
  return { total: summary.total, completed, remaining: summary.total - completed, finished: completed === summary.total };
}
