import JSZip from "jszip";
import Database from "better-sqlite3";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import type {
  AnkiCard,
  AnkiCollection,
  AnkiNote,
  AnkiRevLog,
  AnkiDeckMeta,
  AnkiModelMeta,
  ParsedApkg,
} from "./types";

/**
 * Parse an Anki .apkg file (ZIP containing SQLite DB + media).
 *
 * The .apkg format:
 *  - collection.anki2  (or collection.anki21) — SQLite database
 *  - media             — JSON mapping "0" -> "image.jpg", "1" -> "audio.mp3"
 *  - 0, 1, 2, ...      — actual media files referenced by index
 */
export async function parseApkg(fileBuffer: Buffer): Promise<ParsedApkg> {
  const zip = await JSZip.loadAsync(fileBuffer);

  // Find the SQLite database file
  const dbFileName =
    zip.file("collection.anki21") ? "collection.anki21" :
    zip.file("collection.anki2") ? "collection.anki2" :
    null;

  if (!dbFileName) {
    throw new Error("Invalid .apkg file: no collection database found");
  }

  // Extract SQLite DB to a temp file (better-sqlite3 needs a file path)
  const tmpDir = join(tmpdir(), `anki-import-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, "collection.db");

  try {
    const dbBytes = await zip.file(dbFileName)!.async("nodebuffer");
    writeFileSync(dbPath, dbBytes);

    const db = new Database(dbPath, { readonly: true });

    // Parse collection metadata
    const col = db.prepare("SELECT * FROM col LIMIT 1").get() as AnkiCollection | undefined;
    if (!col) {
      throw new Error("Invalid .apkg: no collection metadata");
    }

    // Parse decks from JSON
    const decksJson = JSON.parse(col.decks) as Record<string, { id: number; name: string }>;
    const decks: AnkiDeckMeta[] = Object.values(decksJson).map((d) => ({
      id: d.id,
      name: d.name,
    }));

    // Parse models (note types) from JSON
    const modelsJson = JSON.parse(col.models) as Record<
      string,
      { id: number; name: string; flds: { name: string; ord: number }[] }
    >;
    const models = new Map<number, AnkiModelMeta>();
    for (const m of Object.values(modelsJson)) {
      models.set(m.id, {
        id: m.id,
        name: m.name,
        fields: m.flds.sort((a, b) => a.ord - b.ord).map((f) => f.name),
      });
    }

    // Parse notes
    const notes = db
      .prepare("SELECT id, mid, flds, tags FROM notes")
      .all() as AnkiNote[];

    // Parse cards
    const cards = db
      .prepare(
        "SELECT id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses FROM cards"
      )
      .all() as AnkiCard[];

    // Parse review log
    const revlog = db
      .prepare(
        "SELECT id, cid, ease, ivl, lastIvl, factor, time, type FROM revlog"
      )
      .all() as AnkiRevLog[];

    db.close();

    // Parse media mapping
    let mediaMap = new Map<string, string>();
    const mediaFiles = new Map<string, Buffer>();
    const mediaJsonFile = zip.file("media");

    if (mediaJsonFile) {
      const mediaJsonStr = await mediaJsonFile.async("string");
      const mediaJson = JSON.parse(mediaJsonStr) as Record<string, string>;
      mediaMap = new Map(Object.entries(mediaJson));

      // Extract media files
      for (const [index, filename] of mediaMap) {
        const mediaFile = zip.file(index);
        if (mediaFile) {
          const bytes = await mediaFile.async("nodebuffer");
          mediaFiles.set(filename, bytes);
        }
      }
    }

    return {
      decks,
      models,
      notes,
      cards,
      revlog,
      mediaMap,
      mediaFiles,
    };
  } finally {
    // Clean up temp files
    try {
      unlinkSync(dbPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
