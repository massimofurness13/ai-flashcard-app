"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DailyGoalCard() {
  const [goal, setGoal] = useState<number>(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.dailyGoal === "number") setGoal(data.dailyGoal);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save(newGoal: number) {
    if (newGoal < 1 || newGoal > 500) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/daily-goal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyGoal: newGoal }),
      });
      if (res.ok) {
        setGoal(newGoal);
        setSavedAt(Date.now());
      }
    } finally {
      setSaving(false);
    }
  }

  const savedRecently = savedAt !== null && Date.now() - savedAt < 3000;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily study goal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily study goal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You&apos;ll see a goal of {goal} cards per day on your home screen.
          Consistency is what makes flashcards work — pick a number you can
          actually hit most days.
        </p>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => save(Math.max(goal - 5, 1))}
            disabled={saving || goal <= 1}
          >
            −5
          </Button>
          <Input
            type="number"
            value={goal}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) setGoal(n);
            }}
            onBlur={() => {
              if (goal < 1) save(1);
              else if (goal > 500) save(500);
              else save(goal);
            }}
            className="w-24 h-9 text-sm text-center"
            min={1}
            max={500}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => save(Math.min(goal + 5, 500))}
            disabled={saving || goal >= 500}
          >
            +5
          </Button>
          <span className="text-sm text-muted-foreground">cards per day</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[10, 20, 25, 50, 100].map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant={goal === preset ? "default" : "outline"}
              onClick={() => save(preset)}
              disabled={saving}
            >
              {preset}
            </Button>
          ))}
        </div>
        {savedRecently && (
          <p className="text-xs text-muted-foreground">Saved ✓</p>
        )}
      </CardContent>
    </Card>
  );
}
