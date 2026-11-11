import { defaultSM2State, sm2, type SM2State } from "./sm2";

export type Direction = "front" | "back";
export type Orientation = Direction | "mixed" | "auto";
export interface RecallState extends SM2State {
  direction: string;
  lastQuality: number;
  lastReviewedAt: Date;
  nextReviewAt: Date;
}
export interface StudyCandidate extends SM2State {
  id: string;
  front: string;
  tags: string | null;
  createdAt: Date;
  nextReviewAt: Date;
  recallStates: RecallState[];
  reviews: { quality: number; reviewedAt: Date }[];
}
export interface StudyPick { id: string; studyDirection: Direction; studyReason: string }
const DAY = 86_400_000;

/** Short failed-recall retry; practising early cannot inflate a successful interval. */
export function scheduleDirection(quality: number, previous: RecallState | null, when: Date) {
  if (quality >= 3 && previous && previous.lastQuality >= 3 && previous.nextReviewAt > when) {
    return { easeFactor: previous.easeFactor, interval: previous.interval,
      repetitions: previous.repetitions, nextReviewAt: previous.nextReviewAt };
  }
  const next = sm2(quality, previous ?? defaultSM2State());
  next.nextReviewAt = new Date(when.getTime() + (quality < 2 ? 10 * 60_000 : next.interval * DAY));
  return next;
}

function directionInfo(card: StudyCandidate, direction: Direction, now: Date) {
  const state = card.recallStates.find(s => s.direction === direction);
  const legacy = card.reviews[0];
  // Old ratings can flag weakness, but cannot prove either direction is known.
  const failed = state ? state.lastQuality < 3 : !!legacy && legacy.quality < 3;
  const unseen = !state;
  return { direction, state, failed, unseen, needs: failed || unseen,
    due: !state || state.nextReviewAt <= now,
    time: state?.nextReviewAt.getTime() ?? card.nextReviewAt.getTime(),
    reason: failed ? "Needs practice" : unseen ? "Not yet tested this way" : "Due again" };
}

export function selectStudyCards(cards: StudyCandidate[], filter: string, orientation: Orientation,
  now = new Date(), random: () => number = Math.random): StudyPick[] {
  const candidates = cards.map(card => {
    let choices = (orientation === "front" || orientation === "back" ? [orientation] : ["front", "back"])
      .map(d => directionInfo(card, d as Direction, now));
    if (filter === "due") choices = choices.filter(c => c.due);
    if (filter === "mastery") choices = choices.filter(c => c.needs);
    if (!choices.length) return null;
    // Smart orientation selects the weaker / untested side, rather than proving the easy side repeatedly.
    choices.sort((a,b) => Number(b.failed)-Number(a.failed) || Number(b.unseen)-Number(a.unseen) || a.time-b.time);
    const choice = orientation === "mixed" ? choices[Math.floor(random()*choices.length)] : choices[0];
    return { card, ...choice, tie: random() };
  }).filter(c => c !== null);
  const priority = (a: typeof candidates[number], b: typeof candidates[number]) =>
    Number(b.failed)-Number(a.failed) || a.time-b.time || a.tie-b.tie;
  if (filter === "random") candidates.sort((a,b) => a.tie-b.tie);
  else if (filter === "mastery") candidates.sort((a,b) => Number(b.failed)-Number(a.failed) || Number(b.unseen)-Number(a.unseen) || a.time-b.time || a.card.id.localeCompare(b.card.id));
  else if (filter === "created") candidates.sort((a,b) => a.card.createdAt.getTime()-b.card.createdAt.getTime());
  else if (filter === "recent") candidates.sort((a,b) => b.card.createdAt.getTime()-a.card.createdAt.getTime());
  else if (filter === "alpha") candidates.sort((a,b) => a.card.front.localeCompare(b.card.front));
  else {
    // Reserve roughly 3 of every 4 slots for due reviews; let new/untried directions in too.
    // Shuffle ties before selection, not the entire prioritised queue afterwards.
    const existing = candidates.filter(c => !c.unseen || c.failed).sort(priority);
    const fresh = candidates.filter(c => c.unseen && !c.failed).sort((a,b) => a.tie-b.tie);
    candidates.length = 0;
    let i=0,j=0;
    while(i<existing.length || j<fresh.length) {
      for(let k=0;k<3&&i<existing.length;k++) candidates.push(existing[i++]);
      if(j<fresh.length)candidates.push(fresh[j++]);
    }
  }
  return candidates.map(c => ({id:c.card.id,studyDirection:c.direction,studyReason:c.reason}));
}

export function fillRandomSession(picks: StudyPick[], limit: number, random: () => number = Math.random) {
  if (!picks.length) return [];
  const result = picks.slice(0, limit);
  while (result.length < limit) {
    const pass = [...picks];
    for(let i=pass.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pass[i],pass[j]]=[pass[j],pass[i]];}
    if(pass.length>1&&result.at(-1)?.id===pass[0].id)[pass[0],pass[1]]=[pass[1],pass[0]];
    result.push(...pass.slice(0,limit-result.length));
  }
  return result;
}
