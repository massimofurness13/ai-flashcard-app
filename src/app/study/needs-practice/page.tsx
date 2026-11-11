"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

type PracticeCard = {id:string;front:string;back:string;studyDirection:"front"|"back";studyReason:string;deck:{name:string}};
function PracticeList() {
  const query=useSearchParams();
  const deckIds=query.get("deckIds")||"",tags=query.get("tags")||"";
  const [cards,setCards]=useState<PracticeCard[]>([]);
  const [total,setTotal]=useState<number|null>(null);
  const [next,setNext]=useState<number|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [page,setPage]=useState(0);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    const params=new URLSearchParams({filter:"mastery",orientation:"auto",limit:"100",offset:String(page),deckIds,tags});
    fetch("/api/review?"+params,{signal:controller.signal}).then(async r=>{
      if(!r.ok)throw Error("Your list could not be loaded.");
      return r.json();
    }).then(data=>{setCards(old=>page===0?data.cards:[...old,...data.cards.filter((c:PracticeCard)=>!old.some(x=>x.id===c.id))]);setTotal(data.total);setNext(data.nextOffset);})
      .catch(e=>{if(e.name!=="AbortError")setError("Your list could not be loaded. Please retry.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[deckIds,tags,page,retry]);
  return <main className="mx-auto max-w-2xl space-y-4 py-6">
    <Link href="/study" className="text-sm underline">Back to study</Link>
    <h1 className="font-editorial text-3xl">Needs practice</h1>
    <p className="text-sm text-muted-foreground">Failed recall comes first, followed by directions you haven’t tested. Cards known both ways leave this list, but return in Spaced review when due.</p>
    {total!==null&&<p className="text-sm">{total} cards need attention</p>}
    <Link className={buttonVariants()} href={"/study?"+new URLSearchParams({filter:"mastery",orientation:"auto",deckIds,tags})}>Practise these packs</Link>
    {error&&<p role="alert">{error} <button className="underline" onClick={()=>{setLoading(true);setError("");setRetry(n=>n+1);}}>Retry</button></p>}
    {total===0&&!loading&&<p>No weak or untested directions remain in these packs.</p>}
    <ul className="divide-y divide-border">{cards.map(c=><li key={c.id} className="py-3">
      <div className="text-xs text-muted-foreground">{c.deck.name} · {c.studyReason} · {c.studyDirection==="front"?"Front":"Back"} first</div>
      <p className="font-medium break-words">{c.studyDirection==="front"?c.front:c.back}</p>
      <p className="text-sm text-muted-foreground break-words">{c.studyDirection==="front"?c.back:c.front}</p>
    </li>)}</ul>
    {loading?<p role="status">Loading…</p>:next!==null&&<Button variant="outline" onClick={()=>{setLoading(true);setError("");setPage(next);}}>Show more</Button>}
  </main>;
}
export default function Page(){return <Suspense fallback={<p>Loading…</p>}><PracticeList/></Suspense>;}
