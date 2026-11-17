import { prisma } from "./db";
import type { DailyPick } from "./daily-study";
import { chooseDailyAllocation, initialDailyAllocation, retentionSamples, storedDailyAllocation } from "./daily-allocation";

/** Only called when creating a new daily set. Existing/resumed plans stay frozen. */
export async function readDailyAllocation(userId: string, day: string, previousPicks: DailyPick[], activeIds: Set<string>, now: Date) {
  if (!storedDailyAllocation(previousPicks)) return initialDailyAllocation();
  const since = new Date(day+"T00:00:00Z");
  since.setUTCDate(since.getUTCDate()-14);
  const plans = await prisma.dailyStudyPlan.findMany({
    where: { userId, day: { gte: since.toISOString().slice(0,10), lt: day } },
    orderBy: { day: "desc" }, take: 14, select: { day: true, createdAt: true, picks: true },
  });
  if (!plans.length) return chooseDailyAllocation(previousPicks,[]);
  const typed = plans.map(p => ({...p,picks:p.picks as unknown as DailyPick[]}));
  const ids = [...new Set(typed.flatMap(p => p.picks.map(p => p.id)))].filter(id => activeIds.has(id));
  const earliest = new Date(Math.min(...plans.map(p => p.createdAt.getTime())));
  const logs = ids.length ? await prisma.reviewLog.findMany({
    where: { card: { deck: { userId, archivedAt: null } }, cardId: { in: ids }, quality: { gt: 0 }, reviewedAt: { gte: earliest, lt: now } },
    select: { cardId: true, direction: true, quality: true, reviewedAt: true }, orderBy: { reviewedAt: "asc" },
  }) : [];
  return chooseDailyAllocation(previousPicks,retentionSamples(typed,logs,activeIds,now));
}
