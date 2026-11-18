"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { prepareAppShell } from "./media-service-worker";
import { useDeviceAccount } from "./device-provider";
import { deviceOwner } from "@/lib/device-media";
import { prepareStudyMedia, saveStudy, studyMediaSaved, type SavedStudy } from "@/lib/offline-study";
import { deleteRecord, readRecord, writeRecord } from "@/lib/device-db";
import { flushReviews } from "@/lib/review-outbox";

// Preparation is automatic, resumable, and limited to the daily set: we don't
// unexpectedly download every pack or generate thousands of unused clips.
export function OfflineStudyProvider() {
  const { user, source } = useDeviceAccount();
  const ownerId = user?.id;
  const pathname = usePathname();
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!ownerId) return;
    const owner = ownerId;
    let cancelled = false;
    let running = false;
    let lastPrepared = 0;
    const report = (message: string) => { if (!cancelled) setStatus(message); };
    async function prepare() {
      if (source !== "session" || running || cancelled || navigator.onLine === false || Date.now() - lastPrepared < 300_000) return;
      running = true;
      try {
        await flushReviews(owner);
        const response = await fetch("/api/review?filter=daily&orientation=auto&limit=120", {signal: AbortSignal.timeout(15000)});
        if (!response.ok) throw new Error("Daily preparation unavailable");
        const data: SavedStudy = await response.json();
        if (cancelled || await deviceOwner() !== owner) return;
        await deleteRecord(owner, "offline:daily-ready");
        await saveStudy(owner, "study:daily", data);
        report("Saving daily cards and audio for offline study…");
        await prepareStudyMedia(owner, data, (done, total) => report(`Saving for offline study · ${done}/${total} cards`));
        if (cancelled || await deviceOwner() !== owner) return;
        const shell = await prepareAppShell();
        if (!shell.ready) throw new Error("Offline app is not ready");
        await writeRecord(owner, "offline:daily-ready", {day: data.daily?.day, cards: data.cards.length});
        report("Ready offline · daily cards, audio and images saved");
        lastPrepared = Date.now();
      } catch {
        report("Offline preparation incomplete · reconnect to finish");
      } finally { running = false; }
    }
    const connectivity = () => {
      if (navigator.onLine === false) {
        void readRecord<SavedStudy>(owner, "study:daily").then(async saved => {
          const mediaReady = saved && await studyMediaSaved(saved.value);
          const shell = await prepareAppShell();
          report(saved && mediaReady && shell.ready
            ? `Offline · saved session${saved.value.daily?.day ? ` from ${saved.value.daily.day}` : ""} · reviews sync when connected`
            : "Offline · saved cards available; some files may need a connection");
        }).catch(() => report("Offline · connect to prepare this device"));
      } else { lastPrepared = 0; void prepare(); }
    };
    const visible = () => { if (document.visibilityState === "visible") void prepare(); };
    const timer = setTimeout(connectivity, 2000);
    const retryTimer = setInterval(visible, 60000);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    document.addEventListener("visibilitychange", visible);
    return () => { cancelled = true; clearTimeout(timer); clearInterval(retryTimer); window.removeEventListener("online", connectivity); window.removeEventListener("offline", connectivity); document.removeEventListener("visibilitychange", visible); };
  }, [ownerId, source]);
  if (!user || !status || !["/", "/study", "/account/downloads"].includes(pathname)) return null;
  return <p role="status" className="px-4 pt-2 text-center text-xs text-muted-foreground">{status}</p>;
}
