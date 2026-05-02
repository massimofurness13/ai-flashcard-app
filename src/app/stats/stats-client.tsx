"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActivityHeatmap } from "@/components/stats/activity-heatmap";
import { GradeHistogram } from "@/components/stats/grade-histogram";
import { CalendarMonth } from "@/components/stats/calendar-month";
import { MetricTile } from "@/components/stats/metric-tile";
import { TodayRing } from "@/components/stats/today-ring";
import { StreakHero } from "@/components/stats/streak-hero";
import type { LetterGrade } from "@/lib/sm2";

interface DeckStat {
  id: string;
  name: string;
  emoji: string | null;
  totalCards: number;
  masteryPercent: number;
}

interface DailyCount {
  date: string;
  count: number;
}

interface Stats {
  totalCards: number;
  cardsDueToday: number;
  cardsReviewedInPeriod: number;
  cardsReviewedToday: number;
  dailyGoal: number;
  goalHitToday: boolean;
  averageQuality: number;
  streak: number;
  longestStreak: number;
  dailyCounts: DailyCount[];
  heatmapData: DailyCount[];
  deckStats: DeckStat[];
  totalReviews: number;
  successRate: number;
  activeDays: number;
  bestDay: string | null;
  bestDayCount: number;
  goalDaysLast30: number;
  gradeHistogram: Record<LetterGrade, number>;
  calendarMonth: DailyCount[];
}

function formatBestDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}

export function StatsClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [period, setPeriod] = useState(7);
  const [demo] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("demo") === "1";
  });

  useEffect(() => {
    fetch(`/api/stats?period=${period}${demo ? "&demo=1" : ""}`)
      .then((res) => res.json())
      .then(setStats);
  }, [period, demo]);

  if (!stats) {
    return (
      <div className="space-y-4">
        <h1 className="font-editorial text-3xl font-medium sm:text-4xl">
          Statistics
        </h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const maxCount = Math.max(...stats.dailyCounts.map((d) => d.count), 1);
  const successRateTone =
    stats.totalReviews === 0
      ? "default"
      : stats.successRate >= 70
        ? "success"
        : stats.successRate >= 50
          ? "default"
          : "danger";

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Header + period filter ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="font-editorial text-3xl font-medium sm:text-4xl">
          Statistics
        </h1>
        <div className="flex gap-1">
          {[
            { label: "7 days", value: 7 },
            { label: "30 days", value: 30 },
            { label: "All time", value: 365 },
          ].map((opt) => (
            <Button
              key={opt.value}
              variant={period === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Hero row: streak + today ring ──────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <StreakHero
            streak={stats.streak}
            longestStreak={stats.longestStreak}
          />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <TodayRing
            done={stats.cardsReviewedToday}
            goal={stats.dailyGoal}
            goalHit={stats.goalHitToday}
          />
        </div>
      </div>

      {/* ── Six metric tiles ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile
          label="Goal days · 30d"
          value={
            <>
              {stats.goalDaysLast30}
              <span className="text-base text-muted-foreground font-normal ml-1">
                / 30
              </span>
            </>
          }
        />
        <MetricTile label="Active days" value={stats.activeDays} />
        <MetricTile
          label="Success rate"
          value={stats.totalReviews > 0 ? `${stats.successRate}%` : "—"}
          hint={`${stats.totalReviews.toLocaleString()} reviews`}
          tone={successRateTone as "default" | "success" | "danger"}
        />
        <MetricTile
          label="Best day"
          value={stats.bestDayCount}
          hint="cards in one day"
          kicker={stats.bestDay ? formatBestDate(stats.bestDay) : undefined}
        />
        <MetricTile
          label="Cards due"
          value={stats.cardsDueToday}
          hint="ready to study"
          tone={stats.cardsDueToday > 0 ? "primary" : "default"}
        />
        <MetricTile
          label={`Reviews · ${period}d`}
          value={stats.cardsReviewedInPeriod}
          hint={`${stats.totalCards.toLocaleString()} total cards`}
        />
      </div>

      {/* ── Calendar (this month) + recent activity bar chart ──── */}
      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">
            This month
          </p>
          <CalendarMonth data={stats.calendarMonth} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Recent activity · {period} days
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              {stats.cardsReviewedInPeriod.toLocaleString()} reviews
            </p>
          </div>
          {stats.dailyCounts.length > 0 ? (
            <div className="flex items-end gap-1 h-40">
              {stats.dailyCounts.map((day) => {
                const barMaxPx = 136;
                const heightPx =
                  day.count > 0
                    ? Math.max(Math.round((day.count / maxCount) * barMaxPx), 8)
                    : 5;
                const date = new Date(day.date);
                const isShortPeriod = stats.dailyCounts.length <= 14;
                const label = isShortPeriod
                  ? date.toLocaleDateString("en", { weekday: "short" })[0]
                  : `${date.getDate()}`;
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                  >
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        day.count > 0
                          ? "bg-gradient-to-t from-primary/80 to-primary"
                          : "bg-muted/60"
                      }`}
                      style={{ height: `${heightPx}px` }}
                      title={`${date.toLocaleDateString("en", {
                        month: "short",
                        day: "numeric",
                      })}: ${day.count} review${day.count === 1 ? "" : "s"}`}
                    />
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">
              No review activity yet.
            </p>
          )}
        </div>
      </div>

      {/* ── 365-day heatmap (full width) ───────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Last 365 days
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            {stats.activeDays} active in {period}d window
          </p>
        </div>
        <ActivityHeatmap data={stats.heatmapData} />
      </div>

      {/* ── Grade distribution + Pack mastery side by side ─────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-4">
            Grade distribution
          </p>
          <GradeHistogram histogram={stats.gradeHistogram} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-4">
            Pack mastery
          </p>
          {stats.deckStats.length > 0 ? (
            <div className="space-y-3">
              {stats.deckStats.map((deck) => (
                <div
                  key={deck.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">
                        {deck.emoji || "📚"} {deck.name}
                      </span>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        {deck.masteryPercent}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-700"
                        style={{ width: `${deck.masteryPercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 self-start">
                    {deck.totalCards}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-6">
              No packs created yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
