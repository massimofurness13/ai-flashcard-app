import Database from "better-sqlite3";
import JSZip from "jszip";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, unlinkSync, readFileSync } from "fs";
import { randomUUID } from "crypto";

interface ExportCard {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  tags: string | null;
  imageUrl: string | null;
  repetitions: number;
  easeFactor: number;
  interval: number;
  nextReviewAt: Date | null;
}

interface ExportDeck {
  id: string;
  name: string;
  description: string | null;
  cards: ExportCard[];
}

/**
 * Build an Anki-compatible .apkg file from a FlashMind deck.
 *
 * The .apkg format:
 *  - collection.anki2 — SQLite database with col, notes, cards, revlog tables
 *  - media — JSON mapping of index -> filename
 *  - 0, 1, 2, ... — media files
 */
export async function buildApkg(deck: ExportDeck): Promise<Buffer> {
  const tmpDir = join(tmpdir(), `anki-export-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, "collection.anki2");

  try {
    const db = new Database(dbPath);

    // Create Anki schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS col (
        id INTEGER PRIMARY KEY,
        crt INTEGER NOT NULL,
        mod INTEGER NOT NULL,
        scm INTEGER NOT NULL,
        ver INTEGER NOT NULL,
        dty INTEGER NOT NULL,
        usn INTEGER NOT NULL,
        ls INTEGER NOT NULL,
        conf TEXT NOT NULL,
        models TEXT NOT NULL,
        decks TEXT NOT NULL,
        dconf TEXT NOT NULL,
        tags TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY,
        guid TEXT NOT NULL,
        mid INTEGER NOT NULL,
        mod INTEGER NOT NULL,
        usn INTEGER NOT NULL,
        tags TEXT NOT NULL,
        flds TEXT NOT NULL,
        sfld TEXT NOT NULL,
        csum INTEGER NOT NULL,
        flags INTEGER NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY,
        nid INTEGER NOT NULL,
        did INTEGER NOT NULL,
        ord INTEGER NOT NULL,
        mod INTEGER NOT NULL,
        usn INTEGER NOT NULL,
        type INTEGER NOT NULL,
        queue INTEGER NOT NULL,
        due INTEGER NOT NULL,
        ivl INTEGER NOT NULL,
        factor INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        lapses INTEGER NOT NULL,
        left INTEGER NOT NULL,
        odue INTEGER NOT NULL,
        odid INTEGER NOT NULL,
        flags INTEGER NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS revlog (
        id INTEGER PRIMARY KEY,
        cid INTEGER NOT NULL,
        usn INTEGER NOT NULL,
        ease INTEGER NOT NULL,
        ivl INTEGER NOT NULL,
        lastIvl INTEGER NOT NULL,
        factor INTEGER NOT NULL,
        time INTEGER NOT NULL,
        type INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS graves (
        usn INTEGER NOT NULL,
        oid INTEGER NOT NULL,
        type INTEGER NOT NULL
      );
    `);

    const now = Math.floor(Date.now() / 1000);
    const deckId = 1;
    const modelId = 1000 + Math.floor(Math.random() * 1000000);

    // Model: Basic (Front/Back with optional Hint)
    const model = {
      [modelId]: {
        id: modelId,
        name: "FlashMind Basic",
        type: 0,
        mod: now,
        usn: -1,
        sortf: 0,
        did: deckId,
        tmpls: [
          {
            name: "Card 1",
            qfmt: "{{Front}}",
            afmt: '{{FrontSide}}<hr id="answer">{{Back}}{{#Hint}}<br><br><i>Hint: {{Hint}}</i>{{/Hint}}',
            bqfmt: "",
            bafmt: "",
            ord: 0,
            bfont: "",
            bsize: 0,
          },
        ],
        flds: [
          { name: "Front", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20, media: [] },
          { name: "Back", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20, media: [] },
          { name: "Hint", ord: 2, sticky: false, rtl: false, font: "Arial", size: 20, media: [] },
        ],
        css: ".card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }",
        latexPre: "",
        latexPost: "",
        latexsvg: false,
        req: [[0, "all", [0]]],
        tags: [],
        vers: [],
      },
    };

    // Deck configuration
    const decks = {
      "1": {
        id: deckId,
        name: deck.name,
        mod: now,
        usn: -1,
        lrnToday: [0, 0],
        revToday: [0, 0],
        newToday: [0, 0],
        timeToday: [0, 0],
        collapsed: false,
        browserCollapsed: false,
        desc: deck.description || "",
        dyn: 0,
        conf: 1,
        extendNew: 0,
        extendRev: 0,
      },
    };

    const dconf = {
      "1": {
        id: 1,
        name: "Default",
        mod: 0,
        usn: 0,
        maxTaken: 60,
        autoplay: true,
        timer: 0,
        replayq: true,
        new: {
          bury: false,
          delays: [1, 10],
          initialFactor: 2500,
          ints: [1, 4, 0],
          order: 1,
          perDay: 20,
        },
        rev: {
          bury: false,
          ease4: 1.3,
          ivlFct: 1,
          maxIvl: 36500,
          perDay: 200,
          hardFactor: 1.2,
        },
        lapse: {
          delays: [10],
          leechAction: 1,
          leechFails: 8,
          minInt: 1,
          mult: 0,
        },
      },
    };

    // Insert collection metadata
    db.prepare(
      "INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      1,
      now,
      now,
      now * 1000,
      11, // Anki schema version
      0,
      0,
      0,
      "{}",
      JSON.stringify(model),
      JSON.stringify(decks),
      JSON.stringify(dconf),
      "{}"
    );

    // Prepare statements
    const insertNote = db.prepare(
      "INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    const insertCard = db.prepare(
      "INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    // Simple checksum function (like Anki's fieldChecksum)
    function fieldChecksum(field: string): number {
      let hash = 0;
      for (let i = 0; i < field.length; i++) {
        const char = field.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
      }
      return Math.abs(hash);
    }

    // Generate a short GUID
    function makeGuid(): string {
      return randomUUID().replace(/-/g, "").slice(0, 10);
    }

    // Track media files to include
    const mediaEntries: { index: number; filename: string; url: string }[] = [];
    let mediaIndex = 0;

    // Insert cards
    const insertAll = db.transaction(() => {
      for (let i = 0; i < deck.cards.length; i++) {
        const card = deck.cards[i];
        const noteId = now * 1000 + i;
        const cardId = now * 1000 + i + deck.cards.length;

        // Build fields string (separated by \x1f)
        let frontHtml = card.front.replace(/\n/g, "<br>");
        const backHtml = card.back.replace(/\n/g, "<br>");
        const hintHtml = (card.hint || "").replace(/\n/g, "<br>");

        // If the card has an image, add it to the front
        if (card.imageUrl) {
          const ext = card.imageUrl.split(".").pop()?.split("?")[0] || "jpg";
          const mediaFilename = `flashmind_${i}.${ext}`;
          mediaEntries.push({
            index: mediaIndex,
            filename: mediaFilename,
            url: card.imageUrl,
          });
          frontHtml += `<br><img src="${mediaFilename}">`;
          mediaIndex++;
        }

        const flds = [frontHtml, backHtml, hintHtml].join("\x1f");
        const tags = card.tags ? ` ${card.tags.replace(/,/g, " ")} ` : "";

        // Map SM-2 state back to Anki format
        const ankiType =
          card.repetitions === 0 ? 0 : // new
          card.interval === 0 ? 1 :     // learning
          2;                              // review
        const ankiQueue = ankiType;
        const ankiFactor = Math.round(card.easeFactor * 1000);
        const ankiDue =
          ankiType === 2 && card.nextReviewAt
            ? Math.floor(card.nextReviewAt.getTime() / 1000 / 86400)
            : i;

        insertNote.run(
          noteId,
          makeGuid(),
          modelId,
          now,
          -1,
          tags,
          flds,
          card.front,
          fieldChecksum(card.front),
          0,
          ""
        );

        insertCard.run(
          cardId,
          noteId,
          deckId,
          0,         // ord
          now,
          -1,        // usn
          ankiType,
          ankiQueue,
          ankiDue,
          card.interval,
          ankiFactor,
          card.repetitions,
          0,         // lapses
          0,         // left
          0,         // odue
          0,         // odid
          0,         // flags
          ""         // data
        );
      }
    });

    insertAll();
    db.close();

    // Build ZIP
    const zip = new JSZip();

    // Add SQLite database
    const dbBytes = readFileSync(dbPath);
    zip.file("collection.anki2", dbBytes);

    // Build media map and download/add media files
    const mediaMap: Record<string, string> = {};

    for (const entry of mediaEntries) {
      try {
        const res = await fetch(entry.url);
        if (res.ok) {
          const bytes = await res.arrayBuffer();
          zip.file(String(entry.index), bytes);
          mediaMap[String(entry.index)] = entry.filename;
        }
      } catch {
        // Skip failed media downloads
      }
    }

    zip.file("media", JSON.stringify(mediaMap));

    // Generate the .apkg file
    const apkgBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    return apkgBuffer;
  } finally {
    // Clean up temp files
    try {
      unlinkSync(dbPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
