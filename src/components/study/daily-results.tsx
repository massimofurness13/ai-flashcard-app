"use client";

import { useEffect, useState } from "react";
import { deviceOwner } from "@/lib/device-media";
import { flushReviews } from "@/lib/review-outbox";
import { listRecords } from "@/lib/device-db";
import type { DailyResults } from "@/lib/study-results";

export function DailyResultsPanel({ day }: { day: string }) {
  const [results, setResults] = useState<DailyResults | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const owner = await deviceOwner();
      if (!owner) throw new Error("Signed out");
      await flushReviews(owner);
      if ((await listRecords(owner,"review:")).length) throw new Error("Reviews still pending");
      const response = await fetch(`/api/study-results?day=${encodeURIComponent(day)}`,{cache:"no-store"});
      if (!response.ok) throw new Error("Results unavailable");
      const data: DailyResults = await response.json();
      if (!cancelled) { setResults(data); setError(false); }
    }
    void load().catch(()=>{if (!cancelled) setError(true);});
    const retry = () => setAttempt(n=>n+1);
    window.addEventListener("online",retry);
    return () => { cancelled=true;window.removeEventListener("online",retry); };
  },[day,attempt]);
  if (error) return <div className="rounded-xl border border-border p-4 text-sm"><p>Your reviews stay saved on this device. Connect to finish syncing and confirm your progress.</p><button className="mt-2 underline underline-offset-4" onClick={()=>{setError(false);setAttempt(n=>n+1);}}>Retry results</button></div>;
  if (!results) return <p role="status" className="text-sm text-muted-foreground">Confirming saved progress…</p>;
  return <section aria-label="Daily progress" className="grid grid-cols-2 gap-3">
    <div className="rounded-xl border border-border bg-card p-4"><p className="text-3xl font-semibold tabular-nums text-green-600 dark:text-green-400">{results.promoted}</p><p className="mt-1 text-sm">Moved to Secure</p></div>
    <div className="rounded-xl border border-border bg-card p-4"><p className="text-3xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">{results.returnedToLearning}</p><p className="mt-1 text-sm">Back to learning</p></div>
    <div className="col-span-2 flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"><div><p className="text-sm font-medium">Retention recall</p><p className="text-xs text-muted-foreground">Known cards you rated Secure</p></div><p className="text-2xl font-semibold tabular-nums">{results.retentionReviewed ? `${results.retentionSecure}/${results.retentionReviewed}` : "—"}</p></div>
    {results.completed<results.total && <p className="col-span-2 text-xs text-muted-foreground">{results.completed}/{results.total} cards rated. Unrated cards stay in your daily set.</p>}
  </section>;
}
