"use client";

interface StreakHeroProps {
  streak: number;
  longestStreak: number;
}

/**
 * Hero tile showing the current daily-study streak with a flame
 * icon. Designed to sit beside the TodayRing in the top hero row of
 * the stats page — same visual weight, same tile height.
 */
export function StreakHero({ streak, longestStreak }: StreakHeroProps) {
  const onFire = streak >= 1;
  return (
    <div className="flex items-center gap-5">
      <div
        className={`relative w-[124px] h-[124px] rounded-full flex items-center justify-center ${
          onFire
            ? "bg-gradient-to-br from-[color-mix(in_oklch,var(--primary)_30%,transparent)] to-[color-mix(in_oklch,var(--glow)_30%,transparent)]"
            : "bg-muted/40"
        }`}
      >
        <span
          className="text-[56px] leading-none"
          aria-hidden
          style={{ filter: onFire ? "none" : "grayscale(100%) opacity(0.5)" }}
        >
          🔥
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Current streak
        </p>
        <p className="font-editorial text-3xl font-medium leading-tight tabular-nums">
          {streak}{" "}
          <span className="text-base text-muted-foreground font-normal">
            day{streak === 1 ? "" : "s"}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Longest: {longestStreak} day{longestStreak === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
