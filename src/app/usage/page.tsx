import Link from "next/link";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getQuotaState } from "@/lib/image-quota";

// Always reflect the latest balances + history — never cache.
export const dynamic = "force-dynamic";

/**
 * Credit usage history. Reads the append-only CreditLedger to show the
 * user exactly where their credits went — which pack, what tier, when.
 * The User row only stores running balances; this page is the story
 * behind them.
 */
export default async function UsagePage() {
  const userId = await getUserId();

  const [quota, entries, userRow] = await Promise.all([
    getQuotaState(userId),
    prisma.creditLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { reminderTimezone: true },
    }),
  ]);

  // Group spends/credits under day headers in the user's own timezone
  // (falls back to UTC if they've never set one via reminders).
  const tz = userRow?.reminderTimezone || "UTC";
  const dayFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  });

  // Build ordered day-groups (entries already sorted newest-first).
  const groups: { day: string; entries: typeof entries }[] = [];
  for (const entry of entries) {
    const day = dayFmt.format(entry.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.entries.push(entry);
    } else {
      groups.push({ day, entries: [entry] });
    }
  }

  // Total credits spent in the recorded window (negative deltas).
  const totalSpent = entries
    .filter((e) => e.delta < 0)
    .reduce((sum, e) => sum + Math.abs(e.delta), 0);

  function tierBadge(tier: string | null): string {
    if (tier === "premium") return "🎨 Premium";
    if (tier === "quick") return "✨ Quick";
    return "";
  }

  function kindLabel(kind: string): string {
    switch (kind) {
      case "spend":
        return "Image";
      case "refund":
        return "Refund";
      case "purchase":
        return "Top-up";
      case "grant":
        return "Added";
      default:
        return kind;
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-editorial text-3xl font-medium">Credit usage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where your credits went — newest first.
          </p>
        </div>
        <Link
          href="/account"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Top up
        </Link>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Remaining
          </p>
          <p className="font-editorial text-xl font-medium">
            {quota.totalRemaining.toLocaleString()}
          </p>
        </div>
        {quota.isPro && (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Monthly left
            </p>
            <p className="font-editorial text-xl font-medium">
              {quota.monthlyRemaining.toLocaleString()}
            </p>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Purchased
          </p>
          <p className="font-editorial text-xl font-medium">
            {quota.credits.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Spent (logged)
          </p>
          <p className="font-editorial text-xl font-medium">
            {totalSpent.toLocaleString()}
          </p>
        </div>
      </div>

      {/* History */}
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            No credit activity recorded yet. From now on, every image you
            generate, every top-up, and every refund shows up here — with the
            pack it was for and the date.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-muted-foreground">
            History is recorded from when this feature went live — credits spent
            before that aren&apos;t itemised here.
          </p>
          {groups.map((group) => {
            const dayTotal = group.entries
              .filter((e) => e.delta < 0)
              .reduce((sum, e) => sum + Math.abs(e.delta), 0);
            return (
              <div key={group.day} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-medium">{group.day}</h2>
                  {dayTotal > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {dayTotal.toLocaleString()} spent
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {group.entries.map((entry) => {
                    const isSpend = entry.delta < 0;
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {entry.deckName ||
                              entry.note ||
                              kindLabel(entry.kind)}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <span>{kindLabel(entry.kind)}</span>
                            {tierBadge(entry.tier) && (
                              <span>· {tierBadge(entry.tier)}</span>
                            )}
                            <span>· {timeFmt.format(entry.createdAt)}</span>
                          </p>
                        </div>
                        <span
                          className={`shrink-0 font-editorial text-base font-medium tabular-nums ${
                            isSpend ? "text-destructive" : "text-primary"
                          }`}
                        >
                          {isSpend ? "" : "+"}
                          {entry.delta.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
