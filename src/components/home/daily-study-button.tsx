"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearStudyResume } from "@/lib/study-resume";
import { unlockAudio } from "@/lib/tts";
import { DAILY_STUDY_TARGET, dailyStudyStatus, type DailyStudySummary } from "@/lib/daily-study";
import { AUTO_FLIP_MAX } from "@/lib/constants";

export function DailyStudyButton({ summary }: { summary?: DailyStudySummary | null }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    return () => { clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  const progress = dailyStudyStatus(summary, now);
  const router=useRouter();
  function start() {
    unlockAudio();
    clearStudyResume();
    let autoFlip=0;
    try {
      const settings=JSON.parse(localStorage.getItem("huella-settings") || "{}");
      if (typeof settings.defaultAutoFlip === "number") autoFlip=Math.max(0,Math.min(AUTO_FLIP_MAX,settings.defaultAutoFlip));
    } catch { /* Use manual flips when preferences cannot be read. */ }
    router.push("/study/session?"+new URLSearchParams({filter:"daily",limit:String(DAILY_STUDY_TARGET),orientation:"auto",autoFlip:String(autoFlip),autoAdvance:"0"}));
  }
  return (
    <Button
      onClick={start}
      className="h-auto min-h-28 w-full justify-between gap-4 rounded-2xl px-6 py-7 text-left shadow-sm hover:bg-primary/90 sm:min-h-36 sm:px-9 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span className="min-w-0 whitespace-normal">
        <span className="block font-editorial text-3xl leading-tight sm:text-4xl">
          {progress.finished ? "Daily study finished" : `${progress.completed ? "Continue" : "Do"} my daily ${progress.total}`}
        </span>
        <span className="mt-2 block text-base font-medium opacity-90" aria-live="polite">
          {progress.finished ? `${progress.total} of ${progress.total} complete · See results` : `${progress.remaining} left${progress.completed ? ` · ${progress.completed} of ${progress.total} complete` : " today"}`}
        </span>
      </span>
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-current/30 sm:h-14 sm:w-14">
        {progress.finished ? <span className="text-3xl">✓</span> : <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-6 w-6"><path d="M8 5.5a1 1 0 0 1 1.52-.85l10 6.5a1 1 0 0 1 0 1.7l-10 6.5A1 1 0 0 1 8 18.5z" /></svg>}
      </span>
    </Button>
  );
}
