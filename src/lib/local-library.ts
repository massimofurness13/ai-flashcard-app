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
export async function selectLocalStudy(owner: string, params: URLSearchParams, now = new Date()): Promise<SavedStudy | null> {
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
  const cards: Array<StudyResumeCard & StudyCandidate> = [];
  for (const id of manifest.deckIds) {
    if (filter !== "daily" && selectedIds?.length && !selectedIds.includes(id)) continue;
    const record = await readRecord<LocalDeckView>(owner,`query:/api/decks/${id}/view`);
    if (!record || record.value.deck.archivedAt) continue;
    const { deck } = record.value;
    for (const raw of deck.cards) {
      let card = reviveCandidate(raw);
      const known = new Set((raw.reviews ?? []).map(r=>(r as typeof r & {id?:string}).id));
      const pending = events.filter(e=>e.cardId === card.id && e.operation !== "undo" && !undone.has(e.eventId) && e.quality > 0 && (unacknowledged.has(e.eventId) || e.savedAt >= record.savedAt) && !known.has(e.eventId))
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
  const limit = Number.isFinite(requested) ? Math.max(1,Math.min(500,Math.floor(requested))) : 25;
  const byId = new Map(cards.map(c=>[c.id,c]));
  if (filter === "daily") {
    const previous = (await readRecord<SavedStudy>(owner,"study:daily"))?.value;
    const previousPicks = previous?.daily?.picks ?? (previous?.cards ?? []).filter(c=>"group" in c) as unknown as DailyPick[];
    const picks = buildDailyPlan(cards,now,Math.random,previousPicks,storedDailyAllocation(previousPicks));
    const plan: LocalPlan = {day,createdAt:now.toISOString(),picks};
    const data: SavedStudy = {cards:picks.map(p=>({...byId.get(p.id)!,...p})),learningLanguage:manifest.learningLanguage,
      daily:{picks,day,timingKey:`local:${owner}:${day}`,completed:0,total:picks.length,ratings:{},mix:{practice:picks.filter(p=>p.group==="practice").length,retention:picks.filter(p=>p.group==="retention").length,new:picks.filter(p=>p.group==="new").length}}};
    // Plan and cards are durable before the first review; completion is never inferred here.
    await writeRecords(owner,[{key:"study:daily",value:data},{key:`plan:${day}`,value:plan}]);
    return data;
  }
  const eligible = selectStudyCards(cards,filter,orientation,now);
  const picks = filter === "random" ? fillRandomSession(eligible,limit) : eligible.slice(0,limit);
  return {cards:picks.map(p=>({...byId.get(p.id)!,...p})),learningLanguage:manifest.learningLanguage};
}
