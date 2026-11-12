"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TrialReport } from "@/lib/fsrs-trial";

export default function SchedulingTrialPage() {
  const [report,setReport]=useState<TrialReport|null>(null);
  const [error,setError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/study-trial",{cache:"no-store",signal:controller.signal})
      .then(async r=>{if(!r.ok)throw new Error();return r.json();})
      .then(data=>{setReport(data);setError(false);})
      .catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[attempt]);
  return <div className="mx-auto max-w-lg space-y-5 py-4">
    <Link className="text-sm text-muted-foreground underline underline-offset-4" href="/study">Back to study</Link>
    <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Scheduling trial</p><h1 className="mt-2 font-editorial text-3xl">Learning from your reviews</h1><p className="mt-2 text-sm text-muted-foreground">FSRS is being compared with your saved history. Your daily set and review dates stay unchanged.</p></div>
    {error ? <div role="alert"><p>Couldn’t load the trial. Your study schedule is unchanged.</p><button className="mt-2 underline" onClick={()=>{setError(false);setAttempt(n=>n+1);}}>Try again</button></div> : !report ? <p role="status">Reading saved reviews…</p> : <>
      <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-border p-4"><p className="text-3xl font-semibold tabular-nums">{report.reviewsReplayed.toLocaleString()}</p><p className="text-sm text-muted-foreground">Reviews replayed</p></div><div className="rounded-xl border border-border p-4"><p className="text-3xl font-semibold tabular-nums">{report.comparisons.toLocaleString()}</p><p className="text-sm text-muted-foreground">Next-day comparisons</p></div></div>
      {report.comparisons>0 ? <div className="rounded-xl border border-border p-4"><h2 className="font-medium">Recall prediction error</h2><p className="mt-1 text-xs text-muted-foreground">Brier score · lower is better · 0 is perfect</p><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><dt>FSRS</dt><dd className="font-semibold tabular-nums">{report.fsrsBrier?.toFixed(3)}</dd></div><div className="flex justify-between gap-4"><dt>Current interval baseline</dt><dd className="font-semibold tabular-nums">{report.intervalBaselineBrier?.toFixed(3)}</dd></div></dl><p className="mt-3 text-xs text-muted-foreground">{report.recalls}/{report.comparisons} compared attempts were rated Secure.</p></div> : <p className="rounded-xl border border-border p-4 text-sm">Keep studying. Comparisons need a rated revisit to the same side at least a day later, with an existing review interval.</p>}
      <p className="text-sm text-muted-foreground">This is a historical comparison using default FSRS parameters, not proof that changing schedules improves learning. Nothing switches automatically.</p>
      <details className="text-sm"><summary className="cursor-pointer font-medium">What is being compared?</summary><div className="mt-3 space-y-2 text-muted-foreground"><p>{report.version}. Each prediction is made before its saved answer is revealed. The two card sides have separate histories.</p><p>Secure counts as recall. Don’t know and Kind of count as incomplete recall. Old Easy ratings remain Easy; other historical successful ratings become Good.</p><p>The interval baseline assumes 90% recall at your recorded review interval. It is a comparison heuristic; the current scheduler does not predict recall probabilities.</p><p>{report.unknownDirection.toLocaleString()} older reviews without a recorded side were excluded. Passive views do not count.</p>{report.truncated && <p>Limited to the first 20,000 graded reviews in active packs. Newer history is not included in this report.</p>}<p>Through {report.through ? new Date(report.through).toLocaleDateString() : "no dated reviews yet"}. Refresh this page after future sessions to include newly saved reviews.</p></div></details>
    </>}
  </div>;
}
