/** Monotonic active time: hidden pages, pauses and editing are excluded. */
export interface StudyTime { elapsedMs: number; timedCards: number }
export class StudyClock {
  private elapsed: number;
  private cards: number;
  private started: number | null = null;
  constructor(initial: StudyTime = { elapsedMs: 0, timedCards: 0 }, private now = () => performance.now()) {
    this.elapsed = initial.elapsedMs;
    this.cards = initial.timedCards;
  }
  start() { if (this.started === null) this.started = this.now(); }
  stop() {
    if (this.started !== null) { this.elapsed += Math.max(0, this.now() - this.started); this.started = null; }
    return this.read();
  }
  reviewed() { this.cards++; return this.read(); }
  read(): StudyTime { return { elapsedMs: this.elapsed + (this.started === null ? 0 : Math.max(0, this.now() - this.started)), timedCards: this.cards }; }
}
export function readStudyTime(key?: string): StudyTime | undefined {
  if (!key || typeof window === "undefined") return;
  try {
    const value = JSON.parse(localStorage.getItem("huella-study-time:" + key) || "null");
    if (value && Number.isFinite(value.elapsedMs) && value.elapsedMs >= 0 && Number.isSafeInteger(value.timedCards) && value.timedCards >= 0) return value;
  } catch { /* Device storage is optional; current-session timing still works. */ }
}
export function saveStudyTime(key: string | undefined, time: StudyTime) {
  if (!key) return;
  try { localStorage.setItem("huella-study-time:" + key, JSON.stringify(time)); } catch { /* Still show in-memory time. */ }
}
export function formatStudyTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
}
