import { deviceOwner } from "./device-media";
import { readRecord, writeRecord, deleteRecord, listRecords } from "./device-db";
import { downloadPack, isPackDownloaded } from "./offline-cache";
import { flushReviews } from "./review-outbox";
import { readOfflineStudy, saveStudy, type SavedStudy } from "./offline-study";
import type { LibraryManifest, LocalDeckView } from "./local-library";

export interface LibrarySyncStatus { phase: "data" | "media" | "ready" | "paused"; packs: number; total: number; failures: number; detail?: string }
const running = new Map<string,Promise<LibrarySyncStatus>>();
export function syncLibrary(owner: string, report: (status: LibrarySyncStatus)=>void, keepGoing:()=>boolean = ()=>true) {
  const existing = running.get(owner); if (existing) return existing;
  const task = (async () => {
    const active = async () => {
      if (!keepGoing() || navigator.onLine === false || await deviceOwner() !== owner) throw new Error("Sync paused");
    };
    const query = async <T>(url: string): Promise<T> => {
      await active();
      if ((url === "/api/library" || url.startsWith("/api/stats")) && (await listRecords(owner,"review:")).length) {
        const baseline=await readRecord<T>(owner,`query:${url}`);
        if(baseline)return baseline.value;
      }
      const response = await fetch(url,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(30000)});
      if (!response.ok) throw new Error(`Sync failed (${response.status})`);
      const data: T = await response.json();
      await active();
      await writeRecord(owner,`query:${url}`,data);
      window.dispatchEvent(new CustomEvent("huella:device-saved",{detail:{owner,url}}));
      return data;
    };
    report({phase:"data",packs:0,total:0,failures:0});
    await flushReviews(owner);
    const config = await query<{decks:Array<{id:string}>}>("/api/study-config");
    const home = await query<{reviewTimeZone?:string}>("/api/library");
    const extras = await query<{archivedDecks:Array<{id:string}>}>("/api/library/extras");
    const deckIds = [...new Set([...config.decks,...extras.archivedDecks].map(d=>d.id))];
    let failures = 0;
    let language: string | null = null;
    // Text and scheduling state for EVERY pack before expensive media work.
    for (let i=0;i<deckIds.length;i++) {
      try { language = (await query<LocalDeckView>(`/api/decks/${deckIds[i]}/view`)).learningLanguage ?? language; }
      catch (error) { await active(); failures++; if (error instanceof Error && /401|403/.test(error.message)) throw error; }
      report({phase:"data",packs:i+1,total:deckIds.length,failures});
    }
    await writeRecord<LibraryManifest>(owner,"library:manifest",{deckIds,timeZone:home.reviewTimeZone || "UTC",learningLanguage:language,syncedAt:Date.now()});
    for (const url of ["/api/stats?period=7","/api/stats?period=30","/api/stats?period=90","/api/stats?period=365","/api/images/quota","/api/subscription/status","/api/user/tags"]) {
      try { await query(url); } catch { await active(); failures++; }
    }
    // Keep an in-progress local sequence intact; a refresh must never reset it.
    try {
      const pendingPlans = await listRecords(owner,"plan:");
      if (!pendingPlans.length) {
      const data = await query<SavedStudy>("/api/review?filter=daily&orientation=auto&limit=120");
      const saved = await readOfflineStudy(owner,"study:daily");
      if (!saved || saved.data.daily?.day !== data.daily?.day || (!saved.snapshot && !(await readRecord(owner,`plan:${data.daily?.day}`)))) await saveStudy(owner,"study:daily",data);
      }
    } catch { await active(); failures++; }
    // Don't fetch or generate an image. This only saves existing artwork and voice clips.
    let packs = 0;
    for (const id of deckIds) {
      await active();
      const view = (await readRecord<LocalDeckView>(owner,`query:/api/decks/${id}/view`))?.value;
      if (!view) continue;
      const input = {deckId:id,cards:view.deck.cards,frontLanguageCode:view.deck.frontLanguageCode ?? null,backLanguageCode:view.deck.backLanguageCode ?? null,learningLanguage:view.learningLanguage};
      try {
        if (!(await isPackDownloaded(input))) await downloadPack(input,p=>report({phase:"media",packs,total:deckIds.length,failures,detail:`${p.phase === "prepare" ? "Audio" : "Files"} ${p.done}/${p.total}`}),active);
        packs++;
      } catch { await active(); failures++; }
      report({phase:"media",packs,total:deckIds.length,failures});
    }
    const status: LibrarySyncStatus = {phase:failures ? "paused" : "ready",packs,total:deckIds.length,failures};
    await writeRecord(owner,"library:sync-status",{...status,at:Date.now()});
    // Trim acknowledged journal entries only once fresh per-pack scheduling is on disk.
    for (const item of await listRecords(owner,"local-review:")) {
      const event = item.value as {eventId:string;cardId:string;operation?:string};
      if (await readRecord(owner,`review:${event.operation === "undo" ? "undo:" : ""}${event.eventId}`)) continue;
      // Retain this small journal for one week for recovery/undo across sync.
      if (item.savedAt < Date.now()-7*86400000) await deleteRecord(owner,item.key);
    }
    report(status); return status;
  })().finally(()=>running.delete(owner));
  running.set(owner,task);return task;
}
