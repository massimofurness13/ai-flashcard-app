import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { APP_NAME, APP_DESCRIPTION } from "../src/lib/constants";
import { mapToHuella } from "../src/lib/anki/map-to-huella";

// ─────────────────────────────────────────────────────────────────
// Rebrand verification — protects the FlashMind → Huella rename
// from regressing. Any stray "FlashMind" / "flashmind" / "Flash
// Mind" reintroduced in source/public/docs/workflows trips this
// suite. If a future commit re-needs the legacy string for a
// migration reason, add it to ALLOWED_FILES with a comment.
// ─────────────────────────────────────────────────────────────────

const REPO_ROOT = join(__dirname, "..");

// Directories we scan for stray FlashMind references.
const SCAN_DIRS = ["src", "public", "docs", ".github"];

// Single-file roots in repo root that should also be scanned.
const SCAN_FILES = ["render.yaml", ".env.example"];

// Extensions we consider "text" — anything else is skipped.
const TEXT_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".html",
  ".css",
  ".yml",
  ".yaml",
  ".txt",
  ".example",
]);

// Files allowed to keep the legacy name (e.g. an explicit
// migration shim, or a test like this one). Paths are repo-root
// relative.
const ALLOWED_FILES = new Set<string>([
  "tests/rebrand.test.ts", // this test deliberately mentions the legacy strings
]);

const FORBIDDEN_PATTERNS = [
  /FlashMind/,
  /Flash Mind/,
  /flashmind/, // catches flashmind.app, flashmind-35q4, flashmind-settings, etc
  /FLASHMIND/,
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function collectScanFiles(): string[] {
  const files: string[] = [];
  for (const d of SCAN_DIRS) files.push(...walk(join(REPO_ROOT, d)));
  for (const f of SCAN_FILES) {
    const full = join(REPO_ROOT, f);
    if (existsSync(full)) files.push(full);
  }
  return files;
}

describe("rebrand: APP_NAME constant", () => {
  it("is Huella", () => {
    expect(APP_NAME).toBe("Huella");
  });

  it("APP_DESCRIPTION mentions Huella, never FlashMind", () => {
    expect(APP_DESCRIPTION).toMatch(/Huella/);
    expect(APP_DESCRIPTION).not.toMatch(/FlashMind/i);
  });
});

describe("rebrand: Anki mapper rename", () => {
  it("exports mapToHuella (the renamed function)", () => {
    expect(typeof mapToHuella).toBe("function");
  });

  it("removed the old map-to-flashmind.ts file", () => {
    expect(existsSync(join(REPO_ROOT, "src/lib/anki/map-to-flashmind.ts"))).toBe(false);
  });

  it("created the new map-to-huella.ts file", () => {
    expect(existsSync(join(REPO_ROOT, "src/lib/anki/map-to-huella.ts"))).toBe(true);
  });
});

describe("rebrand: no stray legacy strings in tracked files", () => {
  const files = collectScanFiles();

  it("scans a non-trivial number of files (sanity check)", () => {
    // If this drops to 0 the test is silently passing.
    expect(files.length).toBeGreaterThan(50);
  });

  for (const file of files) {
    const ext = "." + (file.split(".").pop() ?? "");
    if (!TEXT_EXTS.has(ext)) continue;

    const rel = relative(REPO_ROOT, file);
    if (ALLOWED_FILES.has(rel)) continue;

    it(`${rel} contains no FlashMind/flashmind references`, () => {
      const text = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        const m = text.match(pattern);
        if (m) {
          // Surface a useful failure message: the file, the
          // pattern that matched, and the line excerpt.
          const lineIdx = text.slice(0, m.index!).split("\n").length;
          const lines = text.split("\n");
          const excerpt = lines[lineIdx - 1] ?? "";
          throw new Error(
            `Found "${m[0]}" in ${rel}:${lineIdx}\n  ${excerpt.trim()}`,
          );
        }
      }
    });
  }
});

describe("rebrand: render.yaml service name", () => {
  it("declares service name 'huella' (matters on blueprint re-create)", () => {
    const text = readFileSync(join(REPO_ROOT, "render.yaml"), "utf8");
    expect(text).toMatch(/name:\s*huella\b/);
  });
});
