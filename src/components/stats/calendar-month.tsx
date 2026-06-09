"use client";

interface CalendarDay {
  date: string; // YYYY-MM-DD
  count: number;
}

interface CalendarMonthProps {
  data: CalendarDay[];
}

/**
 * Traditional month grid (Sun-Sat columns, weeks as rows) showing review
 * activity per day. Complements the yearly heatmap — shows "this month
 * at a glance" with actual date numbers rather than anonymous squares.
 */
export function CalendarMonth({ data }: CalendarMonthProps) {
  if (data.length === 0) return null;

  // Parse the YYYY-MM-DD string as a local-time date, not a UTC date.
  // `new Date("2026-04-01")` would parse as UTC midnight, which is still
  // March 31 in timezones west of UTC — that was labelling "April" as
  // "March" for anyone not in UTC.
  function parseLocalDate(iso: string): Date {
    const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }

  const firstDate = parseLocalDate(data[0].date);
  const monthName = firstDate.toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  // Pad the start of the month with empty cells so day-of-week aligns
  const firstDayOfWeek = firstDate.getDay(); // 0 = Sun
  const paddedCells: (CalendarDay | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...data,
  ];

  // Also pad the end so we always have a full week on the bottom row
  while (paddedCells.length % 7 !== 0) paddedCells.push(null);

  const today = new Date().toISOString().split("T")[0];
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  function cellBg(count: number): string {
    if (count === 0) return "bg-muted/30";
    const ratio = count / maxCount;
    if (ratio > 0.75) return "bg-primary";
    if (ratio > 0.5) return "bg-primary/70";
    if (ratio > 0.25) return "bg-primary/40";
    return "bg-primary/20";
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{monthName}</p>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {paddedCells.map((cell, i) => {
          if (!cell) return <div key={i} className="aspect-square" />;
          const isToday = cell.date === today;
          const day = parseLocalDate(cell.date).getDate();
          const strong = cell.count > maxCount * 0.5;
          return (
            <div
              key={cell.date}
              className={`relative aspect-square rounded transition-colors ${cellBg(
                cell.count
              )} ${isToday ? "ring-2 ring-primary" : ""}`}
              title={`${cell.date}: ${cell.count} review${cell.count === 1 ? "" : "s"}`}
            >
              {/* Date number — small, tucked in the top-left corner so the
                  card count can be the prominent figure. */}
              <span
                className={`absolute top-0.5 left-1 text-[9px] leading-none ${
                  strong ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}
              >
                {day}
              </span>
              {/* Review count — the number the user actually cares about,
                  centred and bold. Hidden on zero-activity days. */}
              {cell.count > 0 && (
                <span
                  className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${
                    strong ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {cell.count}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
