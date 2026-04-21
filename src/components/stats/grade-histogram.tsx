"use client";

import { gradeColor, type LetterGrade } from "@/lib/sm2";

interface GradeHistogramProps {
  histogram: Record<LetterGrade, number>;
}

const ORDER: LetterGrade[] = ["New", "F", "D", "C", "B", "A"];

/**
 * Bar chart of every card bucketed by its letter grade. Gives the user
 * an at-a-glance view of how strong their overall deck is.
 */
export function GradeHistogram({ histogram }: GradeHistogramProps) {
  const max = Math.max(...ORDER.map((g) => histogram[g]), 1);
  const total = ORDER.reduce((sum, g) => sum + histogram[g], 0);

  if (total === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-8">
        Rate a few cards to see your grade distribution.
      </p>
    );
  }

  return (
    <div className="flex items-end gap-2 h-40 pt-6">
      {ORDER.map((grade) => {
        const count = histogram[grade];
        const heightPct = count > 0 ? Math.max((count / max) * 100, 4) : 2;
        return (
          <div key={grade} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">{count}</span>
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${heightPct}%`,
                backgroundColor: count > 0 ? gradeColor(grade) : undefined,
                opacity: count > 0 ? 1 : 0.2,
                minHeight: 4,
              }}
              title={`${grade}: ${count} card${count === 1 ? "" : "s"}`}
            />
            <span className="text-xs font-medium">{grade}</span>
          </div>
        );
      })}
    </div>
  );
}
