import {useEffect,useState} from "react";
import {useDeviceAccount} from "@/components/layout/device-provider";
import {readRecord,listRecords} from "@/lib/device-db";
import {useDeviceQuery} from "@/hooks/use-device-query";
import {ArchiveRow} from "@/components/archive/archive-row";
import {SavedDataState} from "@/components/layout/saved-data-state";
import type {LibraryManifest} from "@/lib/local-library";
import {pendingMutations} from "./offline-api";
import {usePathname} from "./navigation";
import Link from "./link";
type SavedPack={deck:{id:string;name:string;emoji:string|null;archivedAt:string|null;cards:unknown[]}};
export function Archive(){
 const {user}=useDeviceAccount();const [packs,setPacks]=useState<SavedPack["deck"][]>([]);
 useEffect(()=>{if(!user)return;let active=true;
  const load=async()=>{const manifest=(await readRecord<LibraryManifest>(user.id,"library:manifest"))?.value;
   const views=await Promise.all((manifest?.deckIds??[]).map(id=>readRecord<SavedPack>(user.id,`query:/api/decks/${id}/view`)));
   if(active)setPacks(views.flatMap(v=>v?.value.deck.archivedAt?[v.value.deck]:[]));};
  void load();window.addEventListener("huella:data-changed",load);window.addEventListener("huella:device-saved",load);
  return()=>{active=false;window.removeEventListener("huella:data-changed",load);window.removeEventListener("huella:device-saved",load);};
 },[user]);
 return <div className="space-y-4"><Link href="/">‹ Home</Link><h1 className="font-editorial text-3xl">Archived packs</h1>{packs.length?packs.map(d=><ArchiveRow key={d.id} id={d.id} name={d.name} emoji={d.emoji} cardCount={d.cards.length} archivedAt={d.archivedAt}/>):<p>No archived packs saved on this device.</p>}</div>;
}
type CreditEntry={id:string;delta:number;kind:string;tier:string|null;deckName:string|null;note:string|null;createdAt:string};
export function Usage(){
 const {data,error,refresh}=useDeviceQuery<{creditUsage:CreditEntry[]}>("/api/library/extras");
 if(!data)return <SavedDataState error={error} retry={refresh}/>;
 return <div className="max-w-2xl space-y-4"><Link href="/account/billing">‹ Credits and plan</Link><h1 className="font-editorial text-3xl">Credit history</h1><p className="text-sm text-muted-foreground">Your latest saved transactions. Updates when connected.</p><ul className="divide-y divide-border">{data.creditUsage.map(row=><li key={row.id} className="flex justify-between gap-3 py-3"><div><p>{row.deckName||row.note||row.kind}</p><p className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()} {row.tier&&`· ${row.tier}`}</p></div><strong className="tabular-nums">{row.delta>0?"+":""}{row.delta}</strong></li>)}</ul>{!data.creditUsage.length&&<p>No transactions yet.</p>}</div>;
}
export function SyncState(){
 const {user,source}=useDeviceAccount();const path=usePathname();const [state,setState]=useState({pending:0,errors:[] as string[]});
 useEffect(()=>{if(!user)return;let active=true;
  const refresh=async()=>{const edits=await pendingMutations(user.id),reviews=await listRecords(user.id,"review:");if(active)setState({pending:edits.length+reviews.length,errors:edits.flatMap(e=>e.error?[e.error]:[])});};
  void refresh();const events=["huella:edits","huella:edits-synced","huella:outbox"];for(const e of events)window.addEventListener(e,refresh);
  return()=>{active=false;for(const e of events)window.removeEventListener(e,refresh);};
 },[user]);
 if(!user||path.startsWith("/study/session"))return null;
 return <div role="status" className="px-4 pt-2 text-xs text-center text-muted-foreground">{state.pending>0&&<span>Saved on this iPhone · {state.pending} change{state.pending===1?"":"s"} waiting to sync. </span>}{source==="local"&&navigator.onLine&&<Link href="/auth/login" className="underline">Sign in to reconnect your saved account</Link>}{state.errors.length>0&&<p className="text-destructive">{state.errors[0]}</p>}</div>;
}
