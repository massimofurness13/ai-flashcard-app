import type { StudyStats } from "@/components/study/study-session";

/**
 * Study-session resume snapshot.
 *
 * When the user taps "Edit card" mid-session we navigate away to the
 * edit page and back. To land them on the EXACT same card with their
 * progress intact, we stash the whole session in sessionStorage rather
 * than re-fetching /api/review on return — a re-fetch would drop every
 * card already reviewed this session (the 6-hour session-boundary rule)
 * and reset "51 / 150" to "0 / 99". Storing the full ordered card list
 * makes the session self-contained: editing or deleting a card just
 * patches this snapshot, and the session resumes from it verbatim.
 *
 * TTL guards against restoring a stale session hours later.
 */
export const STUDY_RESUME_KEY = "study-session-resume";
export const STUDY_RESUME_TTL_MS = 30 * 60 * 1000;

/** The card shape the study session needs to render without a re-fetch. */
export interface StudyResumeCard {
  id: string;
  front: string;
  back: string;
  imageUrl: string | null;
  imageTier: string | null;
  hint: string | null;
  deck: {
    id: string;
    name: string;
    emoji: string | null;
    frontVoice?: string | null;
    backVoice?: string | null;
    frontLanguageCode?: string | null;
    backLanguageCode?: string | null;
  };
}

export interface StudyResumeSnapshot {
  cards: StudyResumeCard[];
  currentIndex: number;
  stats: StudyStats;
  isFlipped: boolean;
  /** Onboarding learning language — kept so the resumed session keeps
   *  its voice fallback without re-hitting /api/review. */
  learningLanguage: string | null;
  savedAt: number;
}

export function writeStudyResume(snapshot: StudyResumeSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STUDY_RESUME_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota / private mode: degrade to a fresh session on return.
  }
}

/** Read the snapshot WITHOUT consuming it. Returns null if absent or expired. */
export function peekStudyResume(): StudyResumeSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STUDY_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudyResumeSnapshot;
    if (!parsed || !Array.isArray(parsed.cards)) return null;
    if (Date.now() - parsed.savedAt > STUDY_RESUME_TTL_MS) {
      clearStudyResume();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearStudyResume(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STUDY_RESUME_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Apply an edit to the matching card in the snapshot (called by the
 * edit form on Save) so the user returns to the session with their
 * correction already showing — no re-fetch, no progress reset.
 */
export function patchStudyResumeCard(
  cardId: string,
  patch: Partial<StudyResumeCard>,
): void {
  const snap = peekStudyResume();
  if (!snap) return;
  let changed = false;
  const cards = snap.cards.map((c) => {
    if (c.id !== cardId) return c;
    changed = true;
    return { ...c, ...patch };
  });
  if (changed) writeStudyResume({ ...snap, cards });
}

/**
 * Remove a deleted card from the snapshot and adjust the cursor so the
 * session carries on (called by the edit form's delete handler). The
 * deleted card is the one being edited — usually the current card — so
 * after removal the cursor lands on what was the next card.
 */
export function removeStudyResumeCard(cardId: string): void {
  const snap = peekStudyResume();
  if (!snap) return;
  const idx = snap.cards.findIndex((c) => c.id === cardId);
  if (idx === -1) return;
  const cards = snap.cards.filter((c) => c.id !== cardId);
  let currentIndex = snap.currentIndex;
  // Removing a card BEFORE the cursor shifts everything down one, so
  // step the cursor back to stay on the same logical card. Removing the
  // current card (idx === currentIndex) leaves the cursor pointing at
  // the next card, which is what we want.
  if (idx < currentIndex) currentIndex -= 1;
  if (currentIndex > cards.length) currentIndex = cards.length;
  writeStudyResume({ ...snap, cards, currentIndex });
}
