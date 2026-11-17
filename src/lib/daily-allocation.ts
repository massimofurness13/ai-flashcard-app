import type { DailyPick } from "./daily-study";

export const DAILY_STUDY_TARGET = 120;
export const DAILY_RETENTION_TARGET = 50;
export const MIN_DAILY_RETENTION = 40;
export const MAX_DAILY_RETENTION = 80;

/** Stored on the first pick in the existing plan JSON; no schema migration.
 * Always read the raw stored picks, including a subsequently deleted card. */
export type DailyAllocation = {
  version: 1;
  retentionTarget: number;
  assessedThroughDay: string | null;
  reason: "starting" | "collecting" | "strong-recall" | "weak-recall" | "steady";
};
export type RetentionSample = { day: string; reviewed: number; secure: number };
export type AllocationPlan = { day: string; createdAt: Date; picks: DailyPick[] };
export type AllocationLog = { cardId: string; direction: string | null; quality: number; reviewedAt: Date };

export function initialDailyAllocation(): DailyAllocation {
  return { version: 1, retentionTarget: DAILY_RETENTION_TARGET, assessedThroughDay: null, reason: "starting" };
}

export function storedDailyAllocation(picks: DailyPick[]): DailyAllocation | undefined {
  const value = picks.find(p => p.dailyAllocation)?.dailyAllocation;
  return value?.version === 1 && Number.isInteger(value.retentionTarget)
    && value.retentionTarget >= MIN_DAILY_RETENTION && value.retentionTarget <= MAX_DAILY_RETENTION
    ? value : undefined;
}

/** Three fresh completed sets per decision, never a daily reaction to one score.
 * These are tunable product thresholds, not claims of a scientific optimum. */
export function chooseDailyAllocation(previousPicks: DailyPick[], samples: RetentionSample[]): DailyAllocation {
  const previous = storedDailyAllocation(previousPicks);
  if (!previous) return initialDailyAllocation(); // First 120-card set starts 70:50.
  const unique = new Map(samples.filter(s => s.reviewed >= 20 && s.secure >= 0 && s.secure <= s.reviewed
    && (!previous.assessedThroughDay || s.day > previous.assessedThroughDay)).map(s => [s.day, s]));
  const recent = [...unique.values()].sort((a,b) => b.day.localeCompare(a.day)).slice(0,3);
  if (recent.length < 3) return { ...previous, reason: "collecting" };
  const rate = recent.reduce((n,s) => n+s.secure,0) / recent.reduce((n,s) => n+s.reviewed,0);
  const change = rate < 0.8 ? 5 : rate >= 0.9 ? -5 : 0;
  return {
    version: 1,
    retentionTarget: Math.max(MIN_DAILY_RETENTION, Math.min(MAX_DAILY_RETENTION, previous.retentionTarget+change)),
    assessedThroughDay: recent[0].day,
    reason: change > 0 ? "weak-recall" : change < 0 ? "strong-recall" : "steady",
  };
}

/** Match the selected face and first genuine grade, bounded to that plan's
 * session window. Replays, passive views and later days cannot improve a score. */
export function retentionSamples(plans: AllocationPlan[], logs: AllocationLog[], activeIds: Set<string>, now: Date): RetentionSample[] {
  const ordered = plans.slice().sort((a,b) => a.createdAt.getTime()-b.createdAt.getTime());
  const samples: RetentionSample[] = [];
  for (let i=0; i<ordered.length; i++) {
    const plan = ordered[i];
    if (!storedDailyAllocation(plan.picks)) continue; // Don't calibrate from the old workload.
    const end = ordered[i+1]?.createdAt ?? now;
    const picks = plan.picks.filter(p => activeIds.has(p.id));
    if (!picks.length) continue;
    const first = new Map<string, AllocationLog>();
    for (const log of logs) {
      if (log.quality < 1 || log.quality > 5 || log.reviewedAt < plan.createdAt || log.reviewedAt >= end) continue;
      const key = log.cardId+":"+log.direction;
      const existing = first.get(key);
      if (!existing || log.reviewedAt < existing.reviewedAt || (log.reviewedAt.getTime() === existing.reviewedAt.getTime() && log.quality < existing.quality)) first.set(key,log);
    }
    if (picks.some(p => !first.has(p.id+":"+p.studyDirection))) continue;
    const retention = picks.filter(p => p.group === "retention");
    samples.push({ day: plan.day, reviewed: retention.length,
      secure: retention.filter(p => first.get(p.id+":"+p.studyDirection)!.quality >= 3).length });
  }
  return samples;
}
