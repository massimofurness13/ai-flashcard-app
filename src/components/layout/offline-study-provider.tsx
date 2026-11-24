"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { prepareAppShell } from "./media-service-worker";
import { useDeviceAccount } from "./device-provider";
import { syncSavedArtwork } from "@/lib/artwork-sync";
import { startDailyAudioSync, syncDailyAudio } from "@/lib/daily-audio-sync";
import { readRecord } from "@/lib/device-db";
import { syncLibrary, type LibrarySyncStatus } from "@/lib/library-sync";

/** All packs sync automatically. Navigation/study never waits for this worker. */
export function OfflineStudyProvider() {
  const {user,source} = useDeviceAccount();
  const ownerId=user?.id;
  const pathname = usePathname();
  const path = useRef(pathname);
  const [status,setStatus] = useState("");
  const retry = useRef<()=>void>(()=>{});
  const dailyAudio = useRef<()=>void>(()=>{});
  useEffect(()=>{path.current=pathname;},[pathname]);
  useEffect(() => {
    if (!ownerId) return;
    const worker = startDailyAudioSync(ownerId, { canPrepare: () => source === "session" });
    dailyAudio.current = worker.kick;
    return () => { worker.stop(); dailyAudio.current = () => {}; };
  }, [ownerId, source]);
  // A delayed, coalesced check discovers a plan saved while opening Study.
  // Navigation never awaits or cancels the daily audio pass.
  useEffect(() => { dailyAudio.current(); }, [pathname]);
  useEffect(() => {
    if (!ownerId) return;
    const sync = () => { void syncSavedArtwork(ownerId); };
    sync();
    const visible = () => { if (document.visibilityState === "visible") sync(); };
    const timer = setInterval(visible, 60000);
    window.addEventListener("online", sync);
    window.addEventListener("huella:device-saved", sync);
    window.addEventListener("huella:artwork-sync", sync);
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); window.removeEventListener("online", sync); window.removeEventListener("huella:device-saved", sync); window.removeEventListener("huella:artwork-sync", sync); document.removeEventListener("visibilitychange", visible); };
  }, [ownerId]);

  useEffect(()=>{
    if (!ownerId) return;
    const owner=ownerId;
    let cancelled=false, running=false, lastSync=0;
    const show=(text:string)=>{if(!cancelled)setStatus(text);};
    const report=(s:LibrarySyncStatus)=>{
      if(s.phase==="data")show(`Syncing library${s.total ? ` · ${s.packs}/${s.total} packs` : ""}…`);
      else if(s.phase==="media")show(`Saving audio and images · ${s.packs}/${s.total} packs ready${s.detail ? ` · ${s.detail}` : ""}`);
      else if(s.phase==="ready")show("Library saved on this device");
      else show("Library saved · some files are still waiting to sync");
    };
    async function sync(force=false) {
      if(cancelled||running)return;
      if(navigator.onLine===false){show("Offline · using your saved library");return;}
      if(source!=="session")return;
      if(path.current.startsWith("/study/session")||(!force && Date.now()-lastSync<300000))return;
      running=true;
      try {
        // Prepare the launch UI independently; one missing audio file must not block it.
        const shell=prepareAppShell();
        // Prioritise daily media transfers without holding up text/statistics sync.
        void syncDailyAudio(owner, { canPrepare: () => source === "session" });
        const result=await syncLibrary(owner,report,()=>!cancelled&&!path.current.startsWith("/study/session"));
        const app=await shell;
        if(!app.ready)show("Library saved · app update still waiting to download");
        if(result.phase==="ready"&&app.ready)lastSync=Date.now();
      }catch(error){
        if(!cancelled)show(error instanceof Error && error.name==="QuotaExceededError" ? "Device storage is full · saved cards are still available" : "Using saved library · sync will resume when connected");
      }finally{running=false;}
    }
    void readRecord<LibrarySyncStatus>(owner,"library:sync-status").then(saved=>{if(saved)report(saved.value);}).catch(()=>{});
    retry.current=()=>{void sync(true);};
    const visible=()=>{if(document.visibilityState==="visible")void sync();};
    const online=()=>{void sync(true);};
    const offline=()=>show("Offline · using your saved library");
    const timer=setTimeout(()=>void sync(),1000);
    const interval=setInterval(visible,60000);
    window.addEventListener("online",online);window.addEventListener("offline",offline);
    window.addEventListener("huella:library-sync",online);
    document.addEventListener("visibilitychange",visible);
    return()=>{cancelled=true;clearTimeout(timer);clearInterval(interval);window.removeEventListener("online",online);window.removeEventListener("offline",offline);window.removeEventListener("huella:library-sync",online);document.removeEventListener("visibilitychange",visible);};
  },[ownerId,source]); // Identity object changes must not restart a long download.
  if(!user||!status||pathname!=="/account/downloads")return null;
  return <div role="status" className="px-4 pt-2 text-center text-xs text-muted-foreground"><span>{status}</span>{pathname==="/account/downloads"&&<button className="ml-2 underline" onClick={()=>retry.current()}>Sync now</button>}</div>;
}
