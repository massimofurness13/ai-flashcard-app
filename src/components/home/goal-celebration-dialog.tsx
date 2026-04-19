"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface GoalCelebrationDialogProps {
  show: boolean;
  dailyGoal: number;
}

export function GoalCelebrationDialog({ show, dailyGoal }: GoalCelebrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (show) {
      // Small delay so it doesn't appear the instant the page loads —
      // feels more celebratory than intrusive.
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [show]);

  async function handleDismiss() {
    if (dismissing) return;
    setDismissing(true);
    try {
      await fetch("/api/user/goal-celebration", { method: "POST" });
    } catch {
      // non-fatal — user can see it again if they refresh, not the end of the world
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={handleDismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl p-6 space-y-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold">You hit your daily goal!</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Nicely done — you&apos;ve studied {dailyGoal} cards today. That consistency
          is what builds fluency.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your goal is currently set to {dailyGoal} cards per day. You can change
          it any time in your Account settings.
        </p>
        <Button onClick={handleDismiss} disabled={dismissing} className="w-full">
          {dismissing ? "..." : "Got it"}
        </Button>
      </div>
    </div>
  );
}
