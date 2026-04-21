"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ActivityHeatmap } from "@/components/stats/activity-heatmap";
import { GradeHistogram } from "@/components/stats/grade-histogram";
import { CalendarMonth } from "@/components/stats/calendar-month";
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
    year: "numeric",
  });
}

export function StatsClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [period, setPeriod] = useState(7);

  useEffect(() => {
    fetch(`/api/stats?period=${period}`)
      .then((res) => res.json())
      .then(setStats);
  }, [period]);

  if (!stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const maxCount = Math.max(...stats.dailyCounts.map((d) => d.count), 1);
  const bestDayPct =
    stats.bestDayCount > 0
      ? Math.min((stats.cardsReviewedToday / stats.bestDayCount) * 100, 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <div className="flex gap-2">
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

      {/* Hero: current streak + today vs goal */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Current streak</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-4xl font-bold">
                {stats.streak > 0 ? "🔥 " : ""}
                {stats.streak}
              </p>
              <p className="text-sm text-muted-foreground">
                day{stats.streak === 1 ? "" : "s"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Longest: {stats.longestStreak} day{stats.longestStreak === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-4xl font-bold">
              {stats.cardsReviewedToday}
              <span className="text-base text-muted-foreground ml-1">
                / {stats.dailyGoal}
              </span>
            </p>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    (stats.cardsReviewedToday / Math.max(stats.dailyGoal, 1)) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
            {stats.goalHitToday && (
              <p className="text-xs text-primary font-medium">Goal hit! 🎉</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Study momentum — Goal Days / Active Days / Best Day / Success Rate */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Goal days (30d)
            </p>
            <p className="text-3xl font-bold mt-1">
              {stats.goalDaysLast30}
              <span className="text-base text-muted-foreground ml-1">/ 30</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Active days
            </p>
            <p className="text-3xl font-bold mt-1">{stats.activeDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Success rate
            </p>
            <p
              className={`text-3xl font-bold mt-1 ${
                stats.successRate >= 70
                  ? "text-green-500"
                  : stats.successRate >= 50
                    ? "text-foreground"
                    : "text-destructive"
              }`}
            >
              {stats.totalReviews > 0 ? `${stats.successRate}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalReviews.toLocaleString()} total reviews
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Best day
              </p>
              {stats.bestDay && (
                <p className="text-[10px] text-muted-foreground">
                  {formatBestDate(stats.bestDay)}
                </p>
              )}
            </div>
            <p className="text-3xl font-bold">{stats.bestDayCount}</p>
            {stats.bestDayCount > 0 && (
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${bestDayPct}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Cards due today</p>
            <p className="text-3xl font-bold text-primary">{stats.cardsDueToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total cards</p>
            <p className="text-3xl font-bold">{stats.totalCards}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Reviews ({period}d)</p>
            <p className="text-3xl font-bold">{stats.cardsReviewedInPeriod}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar month view */}
      <Card>
        <CardHeader>
          <CardTitle>This month</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarMonth data={stats.calendarMonth} />
        </CardContent>
      </Card>

      {/* 365-day heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Last 365 days</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap data={stats.heatmapData} />
        </CardContent>
      </Card>

      {/* Recent activity bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Recent activity ({period} days)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.dailyCounts.length > 0 ? (
            <div className="flex items-end gap-1 h-32">
              {stats.dailyCounts.map((day) => {
                const height =
                  day.count > 0 ? Math.max((day.count / maxCount) * 100, 8) : 4;
                const date = new Date(day.date);
                const isShortPeriod = stats.dailyCounts.length <= 14;
                // Day names for short periods, day-of-month numbers for long
                const label = isShortPeriod
                  ? date.toLocaleDateString("en", { weekday: "short" })
                  : `${date.getDate()}`;
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        day.count > 0 ? "bg-primary" : "bg-muted"
                      }`}
                      style={{ height: `${height}%` }}
                      title={`${date.toLocaleDateString("en", {
                        month: "short",
                        day: "numeric",
                      })}: ${day.count} reviews`}
                    />
                    {isShortPeriod && (
                      <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">
              No review activity yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Grade distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Grade distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <GradeHistogram histogram={stats.gradeHistogram} />
        </CardContent>
      </Card>

      {/* Deck mastery */}
      <Card>
        <CardHeader>
          <CardTitle>Pack mastery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.deckStats.length > 0 ? (
            stats.deckStats.map((deck) => (
              <div key={deck.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {deck.emoji || "\ud83d\udcda"} {deck.name}
                  </span>
                  <span className="text-muted-foreground">
                    {deck.masteryPercent}% ({deck.totalCards} cards)
                  </span>
                </div>
                <Progress value={deck.masteryPercent} className="h-2" />
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">
              No packs created yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
