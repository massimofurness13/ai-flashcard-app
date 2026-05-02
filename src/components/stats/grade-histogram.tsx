"use client";

import { gradeColor, type LetterGrade } from "@/lib/sm2";

interface GradeHistogramProps {
  histogram: Record<LetterGrade, number>;
}

const ORDER: LetterGrade[] = ["A", "B", "C", "D", "F", "New"];

/**
 * Horizontal grade-distribution chart. Stronger grades on top so the
 * eye reads from "best" to "still learning" naturally. Bars are all
 * the same height — only width varies with count — so a deck with
 * 244 New + 37 F + 169 D doesn't render as three near-identical
 * stubby bars (which is what the old vertical layout did when the
 * empty grades padded out the bar widths).
 *
 * Each row stays useful even when the count is zero: the empty
 * track still indicates "this grade exists, you just haven't earned
 * any cards into it yet" instead of disappearing.
 */
export function GradeHistogram({ histogram }: GradeHistogramProps) {
  const max = Math.max(...ORDER.map((g) => histogram[g]), 1);
  const total = ORDER.reduce((sum, g) => sum + histogram[g], 0);

  if (total === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-6">
        Rate a few cards to see your grade distribution.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {ORDER.map((grade) => {
        const count = histogram[grade];
        const widthPct = count > 0 ? Math.max((count / max) * 100, 4) : 0;
        const color = gradeColor(grade);
        return (
          <div
            key={grade}
            className="grid grid-cols-[2.25rem_1fr_3rem] items-center gap-3"
          >
            <span
              className="text-sm font-semibold tabular-nums"
              style={{ color: count > 0 ? color : "var(--muted-foreground)" }}
            >
              {grade}
            </span>
            <div className="relative h-3 rounded-full bg-muted/60 overflow-hidden">
              {count > 0 && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: color,
                  }}
                />
              )}
            </div>
            <span className="text-sm text-foreground tabular-nums text-right">
              {count.toLocaleString()}
            </span>
          </div>
        );
      })}
      <p className="pt-2 text-[11px] text-muted-foreground text-right">
        {total.toLocaleString()} cards in total
      </p>
    </div>
  );
}
