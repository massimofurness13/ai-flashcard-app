import { prisma } from "@/lib/db";
import { dailyProgress, type DailyPick } from "@/lib/daily-study";

/** Same completion rules for Home and the session. Never creates/replaces a plan. */
export async function readDailyPlanProgress(
  userId: string,
  plan: { picks: unknown; createdAt: Date } | null,
  activeIds?: Set<string>,
) {
  const stored = (plan?.picks ?? []) as DailyPick[];
  if (!activeIds) {
    const cards = stored.length ? await prisma.card.findMany({
      where: { id: { in: stored.map(p => p.id) }, deck: { userId, archivedAt: null } },
      select: { id: true },
    }) : [];
    activeIds = new Set(cards.map(c => c.id));
  }
  const picks = stored.filter(p => activeIds.has(p.id));
  const logs = plan && picks.length ? await prisma.reviewLog.findMany({
    where: {
      card: { deck: { userId } }, cardId: { in: picks.map(p => p.id) },
      quality: { gt: 0 }, reviewedAt: { gte: plan.createdAt },
    },
    orderBy: { reviewedAt: "desc" }, select: { cardId: true, direction: true, quality: true },
  }) : [];
  return { picks, ...dailyProgress(picks, logs) };
}
