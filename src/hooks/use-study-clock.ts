"use client";
import { useCallback, useEffect, useState } from "react";
import { StudyClock, readStudyTime, saveStudyTime, type StudyTime } from "@/lib/study-time";

export function useStudyClock(paused: boolean, key?: string, initial?: StudyTime) {
  const [clock] = useState(() => new StudyClock(readStudyTime(key) ?? initial));
  const persist = useCallback(() => { const time = clock.read(); saveStudyTime(key, time); return time; }, [clock, key]);
  const stop = useCallback(() => { clock.stop(); return persist(); }, [clock, persist]);
  const reviewed = useCallback(() => { clock.reviewed(); return persist(); }, [clock, persist]);
  useEffect(() => {
    const sync = () => { if (paused || document.hidden) stop(); else clock.start(); };
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", sync);
    const checkpoint = window.setInterval(persist, 1000);
    return () => {
      stop();
      window.clearInterval(checkpoint);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("pageshow", sync);
    };
  }, [clock, paused, persist, stop]);
  return { stop, reviewed };
}
