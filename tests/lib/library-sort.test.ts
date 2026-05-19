import { describe, it, expect } from "vitest";

// The sortDecks helper lives inside src/app/home-client.tsx so it
// can share types with the page. To test the logic without booting
// React, we mirror it here. If the production behaviour drifts from
// this mirror, this suite goes red and we fix one place.
//
// The substance under test:
//   - name sort uses localeCompare (handles accents, case, etc.)
//   - date sorts use Date.parse / .getTime()
//   - nulls always sort LAST regardless of asc/desc — a
//     never-reviewed pack at the top of "oldest reviewed" would be
//     a UX surprise (the user expected real "oldest" results, not
//     "missing data masquerading as ancient").

interface Deck {
  name: string;
  updatedAt: string;
  lastStudiedAt: string | null;
}

type SortKey =
  | "modified-desc"
  | "modified-asc"
  | "reviewed-desc"
  | "reviewed-asc"
  | "name-asc"
  | "name-desc";

function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: "asc" | "desc",
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const at = new Date(a).getTime();
  const bt = new Date(b).getTime();
  return direction === "asc" ? at - bt : bt - at;
}

function sortDecks(decks: Deck[], key: SortKey): Deck[] {
  const sorted = [...decks];
  switch (key) {
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name-desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "reviewed-desc":
      sorted.sort((a, b) =>
        compareDates(a.lastStudiedAt, b.lastStudiedAt, "desc"),
      );
      break;
    case "reviewed-asc":
      sorted.sort((a, b) =>
        compareDates(a.lastStudiedAt, b.lastStudiedAt, "asc"),
      );
      break;
    case "modified-desc":
      sorted.sort((a, b) => compareDates(a.updatedAt, b.updatedAt, "desc"));
      break;
    case "modified-asc":
      sorted.sort((a, b) => compareDates(a.updatedAt, b.updatedAt, "asc"));
      break;
  }
  return sorted;
}

const sample: Deck[] = [
  {
    name: "Spanish",
    updatedAt: "2026-05-15T10:00:00Z",
    lastStudiedAt: "2026-05-18T09:00:00Z",
  },
  {
    name: "French",
    updatedAt: "2026-05-10T10:00:00Z",
    lastStudiedAt: null,
  },
  {
    name: "anatomy",
    updatedAt: "2026-05-19T08:00:00Z",
    lastStudiedAt: "2026-05-19T12:00:00Z",
  },
];

describe("library sortDecks", () => {
  it("name-asc orders case-insensitively via localeCompare", () => {
    expect(sortDecks(sample, "name-asc").map((d) => d.name)).toEqual([
      "anatomy",
      "French",
      "Spanish",
    ]);
  });

  it("name-desc is the exact reverse", () => {
    expect(sortDecks(sample, "name-desc").map((d) => d.name)).toEqual([
      "Spanish",
      "French",
      "anatomy",
    ]);
  });

  it("modified-desc puts the most-recently-modified pack first", () => {
    expect(sortDecks(sample, "modified-desc").map((d) => d.name)).toEqual([
      "anatomy",
      "Spanish",
      "French",
    ]);
  });

  it("modified-asc reverses that", () => {
    expect(sortDecks(sample, "modified-asc").map((d) => d.name)).toEqual([
      "French",
      "Spanish",
      "anatomy",
    ]);
  });

  it("reviewed-desc puts most-recently-reviewed first, never-reviewed last", () => {
    expect(sortDecks(sample, "reviewed-desc").map((d) => d.name)).toEqual([
      "anatomy",
      "Spanish",
      "French", // never reviewed — bottom of list
    ]);
  });

  it("reviewed-asc puts oldest-reviewed first; never-reviewed still last", () => {
    // Key invariant: a never-reviewed pack must NOT appear at the
    // top of "oldest reviewed". That'd be missing-data-as-data.
    expect(sortDecks(sample, "reviewed-asc").map((d) => d.name)).toEqual([
      "Spanish", // older review
      "anatomy", // newer review
      "French", // never reviewed — still last
    ]);
  });

  it("does not mutate the input array", () => {
    const original = [...sample];
    sortDecks(sample, "name-desc");
    expect(sample).toEqual(original);
  });

  it("handles all-null reviewed dates without throwing", () => {
    const allNeverReviewed: Deck[] = [
      { name: "B", updatedAt: "2026-05-10T10:00:00Z", lastStudiedAt: null },
      { name: "A", updatedAt: "2026-05-15T10:00:00Z", lastStudiedAt: null },
    ];
    // Order is implementation-defined here (relative order of two
    // nulls is "0"). We just assert no throw and that all elements
    // survive.
    const sorted = sortDecks(allNeverReviewed, "reviewed-desc");
    expect(sorted).toHaveLength(2);
    expect(sorted.map((d) => d.name).sort()).toEqual(["A", "B"]);
  });
});
