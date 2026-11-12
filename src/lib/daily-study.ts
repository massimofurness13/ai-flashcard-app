import { toLocalDateKey } from "./timezone";
import { selectStudyCards, type StudyCandidate, type StudyPick } from "./study-selection";

export const DAILY_STUDY_TARGET = 150;

export type DailyPick = StudyPick & { group: "practice" | "retention" | "new" };
export type RecallBand = "unrated" | "dont-know" | "kind-of" | "secure";

/** Read historical scores in place; passive views are never proof of recall. */
export function recallBand(quality: number | undefined): RecallBand {
  if (!quality) return "unrated";
  if (quality === 1) return "dont-know";
  if (quality === 2) return "kind-of";
  return "secure"; // Old Good / Know it / Easy all recorded successful recall.
}

export function isSecureBothWays(card: StudyCandidate): boolean {
  return ["front", "back"].every(direction =>
    card.recallStates.some(s => s.direction === direction && recallBand(s.lastQuality) === "secure"));
}

/** Up to 30 retention; fill the learning slots with practice first, then oldest new cards. */
export function buildDailyPlan(cards: StudyCandidate[], now = new Date(), random: () => number = Math.random): DailyPick[] {
  const practiced = cards.filter(c => c.reviews.length > 0 || c.recallStates.length > 0);
  const weak = practiced.filter(c => !isSecureBothWays(c));
  const secure = practiced.filter(isSecureBothWays);
  const newCards = cards.filter(c => !c.reviews.length && !c.recallStates.length);
  const byId = new Map(cards.map(c => [c.id, c]));
  const practice = selectStudyCards(weak, "mastery", "auto", now, random)
    .map(p => ({ ...p, group: "practice" as const }));
  // Retention queue: due first, then the earliest next review. Every card is unique.
  const retention = selectStudyCards(secure, "random", "auto", now, random)
    .sort((a,b) => {
      const due = (p: StudyPick) => Math.min(...byId.get(p.id)!.recallStates.map(s => s.nextReviewAt.getTime()));
      return due(a)-due(b);
    }).map(p => ({ ...p, group: "retention" as const, studyReason: "Retention — secure both ways" }));
  const selected: DailyPick[] = retention.slice(0,30);
  // Normally 120 learning slots. If retention has fewer than 30 unique
  // cards, use the spare room for learning rather than duplicate reviews.
  selected.push(...practice.slice(0,DAILY_STUDY_TARGET-selected.length));
  if (selected.length < DAILY_STUDY_TARGET) {
    selected.push(...selectStudyCards(newCards, "created", "auto", now, random)
      .slice(0,DAILY_STUDY_TARGET-selected.length)
      .map(p => ({ ...p, group: "new" as const, studyReason: "New vocabulary" })));
  }
  // Interleave the chosen groups so the session does not arrive pack by pack.
  for (let i=selected.length-1;i>0;i--) {
    const j=Math.floor(random()*(i+1)); [selected[i],selected[j]]=[selected[j],selected[i]];
  }
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
