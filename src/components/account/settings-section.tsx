"use client";
import { useState, type ReactNode } from "react";

export function SettingsSection({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={event => setOpen(event.currentTarget.open)} className="group border-b border-border last:border-b-0">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted-foreground mt-0.5">{summary}</span></span>
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
      </summary>
      {open && <div className="px-4 pb-4 space-y-4 [&>div]:shadow-none [&>div]:border-0 [&>div>div]:px-0 [&>div>div:first-child]:pt-0">{children}</div>}
    </details>
  );
}
