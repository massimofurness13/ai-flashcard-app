"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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
  averageQuality: number;
  streak: number;
  dailyCounts: DailyCount[];
  deckStats: DeckStat[];
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

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Cards Due Today</p>
            <p className="text-3xl font-bold text-primary">{stats.cardsDueToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Cards</p>
            <p className="text-3xl font-bold">{stats.totalCards}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Reviews ({period}d)</p>
            <p className="text-3xl font-bold">{stats.cardsReviewedInPeriod}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Streak</p>
            <p className="text-3xl font-bold">{stats.streak} days</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity chart */}
      <Card>
        <CardHeader>
          <CardTitle>Review Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.dailyCounts.length > 0 ? (
            <div className="flex items-end gap-1 h-32">
              {stats.dailyCounts.map((day) => {
                const height = day.count > 0 ? Math.max((day.count / maxCount) * 100, 8) : 4;
                const date = new Date(day.date);
                const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
                      title={`${label}: ${day.count} reviews`}
                    />
                    {stats.dailyCounts.length <= 14 && (
                      <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                        {date.getDate()}
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

      {/* Deck mastery */}
      <Card>
        <CardHeader>
          <CardTitle>Pack Mastery</CardTitle>
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
