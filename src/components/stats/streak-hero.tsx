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
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className="text-base leading-[18px]"
          aria-hidden
          style={{ filter: onFire ? "none" : "grayscale(100%) opacity(0.5)" }}
        >
          🔥
        </span>
        <span>Current streak</span>
      </div>
        <p className="font-editorial text-2xl font-medium leading-tight tabular-nums">
          {streak}{" "}
          <span className="text-base text-muted-foreground font-normal">
            day{streak === 1 ? "" : "s"}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Longest: {longestStreak} day{longestStreak === 1 ? "" : "s"}
        </p>
    </div>
  );
}
