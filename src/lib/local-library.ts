import { listRecords, readRecord, writeRecords } from "./device-db";
import { buildDailyPlan, type DailyPick } from "./daily-study";
import { storedDailyAllocation } from "./daily-allocation";
import { fillRandomSession, selectStudyCards, scheduleDirection, type StudyCandidate, type Orientation } from "./study-selection";
import { sm2 } from "./sm2";
import { toLocalDateKey } from "./timezone";
import { readOfflineStudy, type SavedStudy } from "./offline-study";
import type { StudyResumeCard } from "./study-resume";
import type { PendingReview } from "./review-outbox";

export interface LocalDeckView {
  deck: StudyResumeCard["deck"] & { archivedAt?: string | null; cards: Array<StudyResumeCard & StudyCandidate> };
  learningLanguage: string | null;
}
export interface LibraryManifest { deckIds: string[]; timeZone: string; learningLanguage: string | null; syncedAt: number }
export interface LocalPlan { day: string; createdAt: string; picks: DailyPick[] }

export function reviveCandidate(card: StudyCandidate): StudyCandidate {
  return { ...card, createdAt: new Date(card.createdAt), nextReviewAt: new Date(card.nextReviewAt),
    recallStates: (card.recallStates ?? []).map(s => ({...s,lastReviewedAt:new Date(s.lastReviewedAt),nextReviewAt:new Date(s.nextReviewAt)})),
    reviews: (card.reviews ?? []).map(r => ({...r,reviewedAt:new Date(r.reviewedAt)})) };
}

/** The same pure scheduler as the server, over the account's device library. */
export async function selectLocalStudy(owner: string, params: URLSearchParams, now = new Date(), options?: {all?:boolean;hydrateHistory?:boolean;signal?:AbortSignal}): Promise<SavedStudy | null> {
  options?.signal?.throwIfAborted();
  const manifest = (await readRecord<LibraryManifest>(owner,"library:manifest"))?.value;
  if (!manifest) return null;
  const filter = params.get("filter") || "due";
  let day: string;
  try { day = toLocalDateKey(now,manifest.timeZone); } catch { day = toLocalDateKey(now,"UTC"); }
  if (filter === "daily") {
    const existing = await readOfflineStudy(owner,"study:daily");
    if (existing?.data.daily?.day === day) return existing.data;
  }
  const selectedIds = params.get("deckIds")?.split(",").filter(Boolean);
  const tags = (params.get("tags") || "").toLowerCase().split(",").filter(Boolean);
  const journal = await listRecords(owner,"local-review:");
  const unacknowledged = new Set((await listRecords(owner,"review:")).map(r=>(r.value as PendingReview).eventId));
  const events = journal.map(r => ({...r.value as PendingReview, savedAt:r.savedAt}));
  const undone = new Set(events.filter(e=>e.operation === "undo").map(e=>e.eventId));
  // Index once instead of scanning the complete review journal for every card.
  const eventsByCard = new Map<string, typeof events>();
  for (const event of events) {
    const group = eventsByCard.get(event.cardId) ?? [];
    group.push(event); eventsByCard.set(event.cardId, group);
  }
  const cards: Array<StudyResumeCard & StudyCandidate> = [];
  for (const id of manifest.deckIds) {
    options?.signal?.throwIfAborted();
    if (filter !== "daily" && selectedIds?.length && !selectedIds.includes(id)) continue;
    let record = await readRecord<LocalDeckView>(owner,`query:/api/decks/${id}/view`);
    if (!record || record.value.deck.archivedAt) continue;
    // Old saved pack documents contained text/schedules but no recall history.
    // Missing history is UNKNOWN, never evidence of an unstudied/new card.
    const incomplete = (view: LocalDeckView) => view.deck.cards.some(c => !Array.isArray(c.reviews) || !Array.isArray(c.recallStates));
    if (["daily","mastery","due"].includes(filter) && incomplete(record.value)) {
      if (options?.hydrateHistory === false || navigator.onLine === false) throw new Error("Connect once to restore this pack’s learning history. Your saved reviews are safe.");
      const response = await fetch(`/api/decks/${id}/view`, {cache:"no-store",signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error("Reconnect your account to restore its learning history. Your saved reviews are safe.");
      const restored = await response.json() as LocalDeckView;
      if (restored.deck?.id !== id || !Array.isArray(restored.deck.cards) || incomplete(restored)) throw new Error("Learning history is not available yet. Your saved reviews are safe.");
      // Native transport overlays pending edits; the review journal is applied below.
      await writeRecords(owner,[{key:record.key,value:restored}]);
      record = (await readRecord<LocalDeckView>(owner,record.key))!;
    }
    const { deck } = record.value;
    for (const raw of deck.cards) {
      let card = reviveCandidate(raw);
      const known = new Set((raw.reviews ?? []).map(r=>(r as typeof r & {id?:string}).id));
      const pending = (eventsByCard.get(card.id) ?? []).filter(e=> e.operation !== "undo" && !undone.has(e.eventId) && e.quality > 0 && (unacknowledged.has(e.eventId) || e.savedAt >= record.savedAt) && !known.has(e.eventId))
        .sort((a,b)=>(a.sequence ?? a.savedAt)-(b.sequence ?? b.savedAt));
      for (const review of pending) {
        // Server review IDs are SHA-256(owner:eventId), not the client UUID.
        // A lost acknowledgement must not apply an already-saved rating twice.
        const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${owner}:${review.eventId}`));
        const serverId = [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,"0")).join("");
        if (known.has(serverId)) continue;
        const when = new Date(review.reviewedAt);
        const next = sm2(review.quality,card);
        card = {...card,...next,nextReviewAt:new Date(when.getTime()+next.interval*86400000),reviews:[{quality:review.quality,reviewedAt:when},...card.reviews].slice(0,3)};
        if (review.direction) {
          const state = scheduleDirection(review.quality,card.recallStates.find(s=>s.direction===review.direction) ?? null,when);
          card.recallStates = [...card.recallStates.filter(s=>s.direction!==review.direction),{...state,direction:review.direction,lastQuality:review.quality,lastReviewedAt:when}];
        }
      }
      if (filter !== "daily" && !tags.every(t=>(card.tags || "").toLowerCase().split(",").map(s=>s.trim()).includes(t))) continue;
      cards.push({...raw,...card,deck:{id:deck.id,name:deck.name,emoji:deck.emoji,frontLanguageCode:deck.frontLanguageCode,backLanguageCode:deck.backLanguageCode}});
    }
  }
  const orientation = (["front","back","mixed","auto"].includes(params.get("orientation") || "") ? params.get("orientation") : "auto") as Orientation;
  const requested = Number(params.get("limit") || 25);
  const limit = options?.all ? cards.length : Number.isFinite(requested) ? Math.max(1,Math.min(500,Math.floor(requested))) : 25;
  const byId = new Map(cards.map(c=>[c.id,c]));
  if (filter === "daily") {
    const previous = (await readRecord<SavedStudy>(owner,"study:daily"))?.value;
    const previousPicks = previous?.daily?.picks ?? (previous?.cards ?? []).filter(c=>"group" in c) as unknown as DailyPick[];
    const picks = buildDailyPlan(cards,now,Math.random,previousPicks,storedDailyAllocation(previousPicks));
    const plan: LocalPlan = {day,createdAt:now.toISOString(),picks};
    const data: SavedStudy = {cards:picks.map(p=>({...byId.get(p.id)!,...p})),learningLanguage:manifest.learningLanguage,
      daily:{resultContext:{historyComplete:true,startedAt:plan.createdAt,before:picks.map(p=>({id:p.id,recallStates:(byId.get(p.id)?.recallStates??[]).map(r=>({lastQuality:r.lastQuality,lastReviewedAt:r.lastReviewedAt.toISOString()})),reviews:(byId.get(p.id)?.reviews??[]).map(r=>({quality:r.quality,reviewedAt:r.reviewedAt.toISOString()}))})),logs:[]},picks,day,timingKey:`local:${owner}:${day}`,completed:0,total:picks.length,ratings:{},mix:{practice:picks.filter(p=>p.group==="practice").length,retention:picks.filter(p=>p.group==="retention").length,new:picks.filter(p=>p.group==="new").length}}};
    // Plan and cards are durable before the first review; completion is never inferred here.
    options?.signal?.throwIfAborted();
    await writeRecords(owner,[{key:"study:daily",value:data},{key:`plan:${day}`,value:plan}]);
    return data;
  }
  const eligible = selectStudyCards(cards,filter,orientation,now);
  const picks = filter === "random" ? fillRandomSession(eligible,limit) : eligible.slice(0,limit);
  return {cards:picks.map(p=>({...byId.get(p.id)!,...p})),learningLanguage:manifest.learningLanguage};
}
