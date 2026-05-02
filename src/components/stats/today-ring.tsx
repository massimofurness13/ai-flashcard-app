"use client";

interface TodayRingProps {
  done: number;
  goal: number;
  /** When true, shows a tiny "🎉 Goal hit" ribbon. */
  goalHit?: boolean;
}

/**
 * Circular progress ring for the "today vs daily goal" hero tile.
 * SVG-based — sharp at any size, no canvas, no library. The number
 * sits in the centre, the ring fills clockwise from 12 o'clock.
 *
 * Used as the page's hero metric so a quick scan of the stats
 * dashboard answers "have I done my work today?" before any other
 * tile loads in the eye.
 */
export function TodayRing({ done, goal, goalHit }: TodayRingProps) {
  const safeGoal = Math.max(goal, 1);
  const pct = Math.min((done / safeGoal) * 100, 100);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg
          width="124"
          height="124"
          viewBox="0 0 124 124"
          className="-rotate-90"
        >
          <circle
            cx="62"
            cy="62"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeWidth="10"
          />
          <circle
            cx="62"
            cy="62"
            r={radius}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-editorial text-3xl font-medium tabular-nums leading-none">
            {done}
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums leading-none mt-1">
            / {goal}
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Today
        </p>
        <p className="font-editorial text-2xl font-medium leading-tight">
          {Math.round(pct)}% of goal
        </p>
        {goalHit ? (
          <p className="text-xs text-[color:var(--primary)] font-medium">
            🎉 Goal hit for today
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {Math.max(goal - done, 0)} card
            {Math.max(goal - done, 0) === 1 ? "" : "s"} to go
          </p>
        )}
      </div>
    </div>
  );
}
