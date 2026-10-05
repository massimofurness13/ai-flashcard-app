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
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <svg
          width="18"
          height="18"
          viewBox="0 0 124 124"
          className="-rotate-90 shrink-0"
          aria-hidden="true"
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
        <span>Daily goal</span>
      </div>
        <p className="font-editorial text-2xl font-medium leading-tight tabular-nums">
          {done}<span className="text-base text-muted-foreground font-normal"> / {goal}</span>
        </p>
        {goalHit ? (
          <p className="text-xs text-[color:var(--primary)] font-medium">
            Goal reached
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {Math.max(goal - done, 0)} card
            {Math.max(goal - done, 0) === 1 ? "" : "s"} to go
          </p>
        )}
    </div>
  );
}
