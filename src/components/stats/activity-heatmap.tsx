"use client";

interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number;
}

interface ActivityHeatmapProps {
  data: HeatmapDay[];
}

/**
 * GitHub-style contribution graph. Squares colored by review count.
 * 7 rows (days of week, Mon-Sun top to bottom), columns = weeks.
 */
export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-4">
        No activity yet — study a few cards to fill in this grid.
      </p>
    );
  }

  // Build a map for quick lookup
  const byDate = new Map(data.map((d) => [d.date, d.count]));

  // Align the grid so the rightmost column ends today.
  // Walk back 53 weeks (371 days) to guarantee we fill the grid.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the most recent Sunday ≤ today to anchor the grid's right edge
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const gridEnd = new Date(today);
  // We want columns to end on the current week. Use today as the last day.

  const weeks: { date: string; count: number | null }[][] = [];
  let column: { date: string; count: number | null }[] = [];

  const cursor = new Date(gridEnd);
  cursor.setDate(cursor.getDate() - 7 * 52); // ~1 year back
  // Rewind to the Sunday on or before cursor
  while (cursor.getDay() !== 0) {
    cursor.setDate(cursor.getDate() - 1);
  }

  const iter = new Date(cursor);
  while (iter <= gridEnd) {
    const dateStr = iter.toISOString().split("T")[0];
    const count = byDate.has(dateStr) ? byDate.get(dateStr)! : null;
    column.push({ date: dateStr, count });

    if (iter.getDay() === 6 /* Saturday */) {
      weeks.push(column);
      column = [];
    }
    iter.setDate(iter.getDate() + 1);
  }
  if (column.length > 0) weeks.push(column);

  function levelClass(count: number | null): string {
    if (count === null) return "bg-transparent";
    if (count === 0) return "bg-muted";
    if (count <= 5) return "bg-primary/30";
    if (count <= 15) return "bg-primary/60";
    if (count <= 30) return "bg-primary/80";
    return "bg-primary";
  }

  // Month labels along the top
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const firstCell = week[0];
    if (firstCell) {
      const m = new Date(firstCell.date).getMonth();
      if (m !== lastMonth) {
        monthLabels.push({
          col: i,
          label: new Date(firstCell.date).toLocaleString("en", { month: "short" }),
        });
        lastMonth = m;
      }
    }
  });

  return (
    <div className="space-y-2 overflow-x-auto">
      {/* Month labels */}
      <div className="flex text-[10px] text-muted-foreground gap-[3px] pl-6">
        {weeks.map((_, i) => {
          const label = monthLabels.find((m) => m.col === i);
          return (
            <div key={i} className="w-[11px] shrink-0">
              {label ? label.label : ""}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex gap-[3px]">
        {/* Weekday labels */}
        <div className="flex flex-col gap-[3px] text-[10px] text-muted-foreground w-5 shrink-0">
          {["", "M", "", "W", "", "F", ""].map((d, i) => (
            <div key={i} className="h-[11px] leading-[11px]">
              {d}
            </div>
          ))}
        </div>

        {/* Columns */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, di) => {
              const cell = week[di];
              if (!cell) {
                return <div key={di} className="w-[11px] h-[11px]" />;
              }
              return (
                <div
                  key={di}
                  className={`w-[11px] h-[11px] rounded-sm ${levelClass(cell.count)}`}
                  title={`${cell.date}: ${cell.count ?? 0} reviews`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pl-6 mt-2">
        <span>Less</span>
        <div className="w-[11px] h-[11px] rounded-sm bg-muted" />
        <div className="w-[11px] h-[11px] rounded-sm bg-primary/30" />
        <div className="w-[11px] h-[11px] rounded-sm bg-primary/60" />
        <div className="w-[11px] h-[11px] rounded-sm bg-primary/80" />
        <div className="w-[11px] h-[11px] rounded-sm bg-primary" />
        <span>More</span>
      </div>
    </div>
  );
}
