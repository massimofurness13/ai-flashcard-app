/**
 * Anki internal data structures.
 * These map directly to the SQLite tables in .apkg files.
 */

/** Anki collection metadata (col table) */
export interface AnkiCollection {
  id: number;
  /** JSON string of deck configurations */
  decks: string;
  /** JSON string of model/note type configurations */
  models: string;
}

/** Anki note (notes table) */
export interface AnkiNote {
  id: number;
  /** Note type / model ID */
  mid: number;
  /** Fields separated by \x1f (unit separator) */
  flds: string;
  /** Tags separated by spaces */
  tags: string;
}

/** Anki card (cards table) */
export interface AnkiCard {
  id: number;
  /** Note ID */
  nid: number;
  /** Deck ID */
  did: number;
  /** Card template ordinal */
  ord: number;
  /** Card type: 0=new, 1=learning, 2=review, 3=relearn */
  type: number;
  /** Card queue: similar to type but with suspended/buried states */
  queue: number;
  /** Due date (review interval from collection creation, or learning step) */
  due: number;
  /** Current interval in days (0 for new cards) */
  ivl: number;
  /** Ease factor (permille, e.g. 2500 = 2.5) */
  factor: number;
  /** Number of reviews */
  reps: number;
  /** Number of lapses */
  lapses: number;
}

/** Anki review log entry (revlog table) */
export interface AnkiRevLog {
  id: number;
  /** Card ID */
  cid: number;
  /** Ease button pressed: 1=again, 2=hard, 3=good, 4=easy */
  ease: number;
  /** Interval after review (negative = seconds, positive = days) */
  ivl: number;
  /** Previous interval */
  lastIvl: number;
  /** Ease factor after review (permille) */
  factor: number;
  /** Review duration in milliseconds */
  time: number;
  /** Review type: 0=learn, 1=review, 2=relearn, 3=cram */
  type: number;
}

/** Parsed Anki deck metadata */
export interface AnkiDeckMeta {
  id: number;
  name: string;
}

/** Parsed Anki model (note type) metadata */
export interface AnkiModelMeta {
  id: number;
  name: string;
  /** Field names in order */
  fields: string[];
}

/** A fully parsed .apkg file */
export interface ParsedApkg {
  decks: AnkiDeckMeta[];
  models: Map<number, AnkiModelMeta>;
  notes: AnkiNote[];
  cards: AnkiCard[];
  revlog: AnkiRevLog[];
  /** Map of media filename index (string number) -> original filename */
  mediaMap: Map<string, string>;
  /** Map of original filename -> file bytes */
  mediaFiles: Map<string, Buffer>;
}
