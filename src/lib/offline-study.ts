import { readRecord, writeRecord } from "./device-db";
import { deviceOwner } from "./device-media";
import { downloadPack, isPackDownloaded, type DownloadPackInput } from "./offline-cache";
import type { StudyResumeSnapshot, StudyResumeCard } from "./study-resume";

export interface SavedStudy {
  cards: StudyResumeCard[];
  learningLanguage: string | null;
  daily?: { resultContext?: {historyComplete?:boolean;startedAt:string;before:Array<{id:string;recallStates?:Array<{lastQuality:number;lastReviewedAt:string}>;reviews:Array<{quality:number;reviewedAt:string}>}>;logs:Array<{id:string;cardId:string;direction:string|null;quality:number;reviewedAt:string}>}; picks?: import("./daily-study").DailyPick[]; day: string; timingKey?: string; completed: number; total: number; ratings: Record<number, number>; mix: { practice: number; retention: number; new: number } } | null;
}
export function studyKey(params: URLSearchParams): string {
  // A daily plan is server-selected, independent of flip timers and pack filters.
  if (params.get("filter") === "daily") return "study:daily";
  const selection = new URLSearchParams();
  for (const key of ["deckIds", "limit", "filter", "orientation", "tags"]) {
    const value = params.get(key);
    if (value) selection.set(key, value);
  }
  return `study:${selection}`;
}
export function checkpointKey(key: string) { return `checkpoint:${key}`; }
export async function saveStudy(owner: string, key: string, data: SavedStudy) {
  if (!Array.isArray(data.cards)) throw new Error("Invalid study response.");
  await writeRecord(owner, key, data);
}
export async function readOfflineStudy(owner: string, key: string) {
  const record = await readRecord<SavedStudy>(owner, key);
  if (!record) return null;
  const saved = record.value;
  const snapshot = (await readRecord<StudyResumeSnapshot>(owner, checkpointKey(key)))?.value;
  // Never restore yesterday's progress over a freshly prepared daily plan.
  const matching = snapshot && (saved.daily
    ? snapshot.timingKey === saved.daily.timingKey && snapshot.dailyDay === saved.daily.day
    : snapshot.savedAt >= record.savedAt);
  return { data: saved, snapshot: matching ? snapshot : null };
}

function studyPacks(data: SavedStudy): DownloadPackInput[] {
  const decks = new Map<string, StudyResumeCard[]>();
  for (const card of data.cards) decks.set(card.deck.id, [...(decks.get(card.deck.id) ?? []), card]);
  return [...decks].map(([id, cards]) => ({deckId: `daily-offline:${id}`, cards,
    frontLanguageCode: cards[0].deck.frontLanguageCode ?? null,
    backLanguageCode: cards[0].deck.backLanguageCode ?? null,
    learningLanguage: data.learningLanguage}));
}
export async function studyMediaSaved(data: SavedStudy): Promise<boolean> {
  for (const pack of studyPacks(data)) if (!(await isPackDownloaded(pack))) return false;
  return true;
}
// The media manifest is only marked ready after ALL clips and artwork exist.
export async function prepareStudyMedia(owner: string, data: SavedStudy, progress: (done: number, total: number) => void) {
  let done = 0;
  const total = data.cards.length;
  for (const pack of studyPacks(data)) {
    if (await deviceOwner() !== owner) throw new Error("Account changed.");
    await downloadPack(pack, p => {
      progress(done + (p.total ? Math.floor(pack.cards.length * p.done / p.total / 2) : 0) + (p.phase === "save" ? Math.floor(pack.cards.length / 2) : 0), total);
    });
    done += pack.cards.length; progress(done, total);
  }
}
