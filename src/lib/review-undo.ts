import type { SM2State } from "./sm2";
import type { RecallState } from "./study-selection";
export function scheduleSnapshot(state: SM2State & { nextReviewAt: Date }) {
  return { easeFactor:state.easeFactor, interval:state.interval, repetitions:state.repetitions, nextReviewAt:state.nextReviewAt.toISOString() };
}
export function recallSnapshot(state: RecallState | null) {
  return state ? {...scheduleSnapshot(state),lastQuality:state.lastQuality,lastReviewedAt:state.lastReviewedAt.toISOString()} : null;
}
export type UndoSnapshot = {
  card: {before:ReturnType<typeof scheduleSnapshot>;after:ReturnType<typeof scheduleSnapshot>} | null;
  recall: {direction:string;before:ReturnType<typeof recallSnapshot>;after:ReturnType<typeof recallSnapshot>} | null;
};
export function restoreSchedule(state: ReturnType<typeof scheduleSnapshot>) {
  return {...state,nextReviewAt:new Date(state.nextReviewAt)};
}
export function restoreRecall(state: NonNullable<ReturnType<typeof recallSnapshot>>) {
  return {...restoreSchedule(state),lastReviewedAt:new Date(state.lastReviewedAt),lastQuality:state.lastQuality};
}
export function sameSnapshot(a: object | null, b: object | null) {
  if (!a || !b) return a === b;
  // PostgreSQL JSONB can reorder keys; compare the values, not serialization order.
  const left = a as Record<string,unknown>, right = b as Record<string,unknown>;
  return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => left[key] === right[key]);
}
