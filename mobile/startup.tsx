import {useEffect,useState} from "react";
import {NativeStore} from "@/lib/native-device";
import {prepareStartup} from "./prepare-startup";

export function NativeStartup({onReady}:{onReady:()=>void}){
 const [attempt,setAttempt]=useState(0);
 const [failed,setFailed]=useState(false);
 const [progress,setProgress]=useState<{completed:number;total:number}|null>(null);
 useEffect(()=>{
  let active=true;
  const listener=NativeStore.addListener("migrationProgress",next=>{if(active)setProgress(next);}).catch(()=>null);
  // Promise boundary also catches denied localStorage access.
  void Promise.resolve().then(()=>prepareStartup(window.localStorage)).then(()=>{if(active)onReady();},()=>{if(active)setFailed(true);});
  return()=>{active=false;void listener.then(handle=>handle?.remove());};
 },[attempt,onReady]);
 const percent=progress&&progress.total>0?Math.min(100,Math.round(progress.completed/progress.total*100)):null;
 return <main className="flex min-h-[80dvh] flex-col items-center justify-center px-8 text-center">
  <h1 className="font-serif text-5xl italic text-primary">Huella</h1>
  {failed?<div className="mt-8 max-w-xs" role="alert">
   <h2 className="text-lg font-semibold">Couldn’t finish opening</h2>
   <p className="mt-2 text-sm text-muted-foreground">Your previous library is still on this phone. Connect to the internet and retry this one-time upgrade.</p>
   <button className="mt-6 min-h-12 rounded-xl bg-primary px-8 font-semibold text-primary-foreground" onClick={()=>{setFailed(false);setProgress(null);setAttempt(value=>value+1);}}>Try again</button>
  </div>:<div className="mt-8 w-48" role="status" aria-live="polite">
   <p className="mb-4 text-sm text-muted-foreground">{progress?"Updating your library":"Opening your library"}</p>
   <progress className="h-1.5 w-full accent-primary" max={100} {...(percent===null?{}:{value:percent})} aria-label="Library upgrade"/>
  </div>}
 </main>;
}
