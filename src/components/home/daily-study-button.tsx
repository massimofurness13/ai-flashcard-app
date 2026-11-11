"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearStudyResume } from "@/lib/study-resume";
import { unlockAudio } from "@/lib/tts";
import { AUTO_FLIP_MAX } from "@/lib/constants";

export function DailyStudyButton() {
  const router=useRouter();
  function start() {
    unlockAudio();
    clearStudyResume();
    let autoFlip=0;
    try {
      const settings=JSON.parse(localStorage.getItem("huella-settings") || "{}");
      if (typeof settings.defaultAutoFlip === "number") autoFlip=Math.max(0,Math.min(AUTO_FLIP_MAX,settings.defaultAutoFlip));
    } catch { /* Use manual flips when preferences cannot be read. */ }
    router.push("/study/session?"+new URLSearchParams({filter:"daily",limit:"100",orientation:"auto",autoFlip:String(autoFlip),autoAdvance:"0"}));
  }
  return <div className="space-y-2">
    <Button onClick={start}>Do my daily 100</Button>
    <p className="max-w-sm text-xs text-muted-foreground">Practice + retention. Up to 10 new cards only when practice runs short. Your daily set is saved so you can continue later.</p>
  </div>;
}
