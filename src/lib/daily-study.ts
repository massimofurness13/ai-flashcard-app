import { selectStudyCards, type StudyCandidate, type StudyPick } from "./study-selection";

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

/** 70 practice / 30 retention, at most ten new items when existing practice is short. */
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
  const selected: DailyPick[] = [...practice.splice(0,70), ...retention.splice(0,30)];
  // Extra overdue retention takes precedence over introducing new material.
  while (selected.length < 100 && retention.length &&
    byId.get(retention[0].id)!.recallStates.some(s => s.nextReviewAt <= now)) {
    selected.push(retention.shift()!);
  }
  if (weak.length < 70 && selected.length < 100) {
    selected.push(...selectStudyCards(newCards, "created", "auto", now, random)
      .slice(0, Math.min(10, 70-weak.length, 100-selected.length))
      .map(p => ({ ...p, group: "new" as const, studyReason: "New vocabulary" })));
  }
  selected.push(...retention.splice(0,100-selected.length));
  selected.push(...practice.splice(0,100-selected.length));
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
