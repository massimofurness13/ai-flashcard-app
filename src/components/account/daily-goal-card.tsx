"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MIN_GOAL = 1;
const MAX_GOAL = 1000;

export function DailyGoalCard() {
  // `goal` is the canonical saved value. `inputValue` is the string
  // currently in the text field while the user is editing — kept
  // separate so they can clear the field and type a fresh number
  // without React snapping the value back mid-keystroke.
  const [goal, setGoal] = useState<number>(25);
  const [inputValue, setInputValue] = useState<string>("25");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.dailyGoal === "number") {
          setGoal(data.dailyGoal);
          setInputValue(String(data.dailyGoal));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save(newGoal: number) {
    const clamped = Math.min(Math.max(newGoal, MIN_GOAL), MAX_GOAL);
    setSaving(true);
    try {
      const res = await fetch("/api/user/daily-goal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyGoal: clamped }),
      });
      if (res.ok) {
        setGoal(clamped);
        setInputValue(String(clamped));
        setSavedAt(Date.now());
      }
    } finally {
      setSaving(false);
    }
  }

  function commitInput() {
    const parsed = parseInt(inputValue, 10);
    if (Number.isNaN(parsed) || parsed < MIN_GOAL) {
      // Invalid → snap input back to the last saved value, don't save.
      setInputValue(String(goal));
      return;
    }
    save(parsed);
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
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => save(Math.max(goal - 5, MIN_GOAL))}
            disabled={saving || goal <= MIN_GOAL}
          >
            −5
          </Button>
          {/* Free-typing input: shows the current edit string, commits
           *  on blur or Enter. The user can clear it and type any
           *  number from 1 to 1000 without React reverting mid-stroke. */}
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={commitInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-24 h-9 text-sm text-center"
            aria-label="Daily card goal"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => save(Math.min(goal + 5, MAX_GOAL))}
            disabled={saving || goal >= MAX_GOAL}
          >
            +5
          </Button>
          <span className="text-sm text-muted-foreground">cards per day</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[10, 25, 50, 100, 200, 300, 500].map((preset) => (
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
