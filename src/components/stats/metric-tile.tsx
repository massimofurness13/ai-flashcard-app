"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetricTileProps {
  label: string;
  value: ReactNode;
  /** Tiny supporting line under the value (e.g. "412 reviews"). */
  hint?: ReactNode;
  /** Optional kicker shown to the right of the label (e.g. a date). */
  kicker?: ReactNode;
  /** Tone:
   *   - default: standard surface
   *   - primary: filled with primary tint, used for 1 hero metric per page
   *   - success / warning / danger: derived from value semantics
   */
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
}

/**
 * Dense stat tile used across the stats page. Smaller padding than a
 * regular Card, designed to live in a tight 4-up or 6-up grid. The
 * tone variants give the page colour as data — green = good, red =
 * needs attention — without us having to wire conditional Tailwind
 * classes at every call site.
 */
export function MetricTile({
  label,
  value,
  hint,
  kicker,
  tone = "default",
  className,
}: MetricTileProps) {
  const toneClasses = {
    default: "border-border bg-card",
    primary: "border-primary/30 bg-primary/5",
    success: "border-green-500/25 bg-green-500/5",
    warning: "border-amber-500/25 bg-amber-500/5",
    danger: "border-destructive/30 bg-destructive/5",
  }[tone];

  const valueClasses = {
    default: "text-foreground",
    primary: "text-foreground",
    success: "text-green-500",
    warning: "text-amber-500",
    danger: "text-destructive",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5 flex flex-col gap-1.5",
        toneClasses,
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {kicker && (
          <p className="text-[10px] text-muted-foreground/70 truncate">
            {kicker}
          </p>
        )}
      </div>
      <p
        className={cn(
          "font-editorial text-3xl sm:text-4xl font-medium leading-none tabular-nums",
          valueClasses
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}
