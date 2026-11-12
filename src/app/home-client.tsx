"use client";
import type { DailyStudySummary } from "@/lib/daily-study";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreateMenu } from "@/components/home/create-menu";
import { FolderGroup } from "@/components/home/folder-group";
import { DeckCard } from "@/components/deck/deck-card";
import { GoalCelebrationDialog } from "@/components/home/goal-celebration-dialog";
import { FirstTimeWelcome } from "@/components/home/first-time-welcome";
import { DailyStudyButton } from "@/components/home/daily-study-button";

interface Deck {
  id: string;
  name: string;
  emoji: string | null;
  _count: { cards: number };
  grade: string;
  /** ISO timestamps (server pre-serialises Dates so client-side
   *  sort + relative-time math don't need to construct Date
   *  objects twice). lastStudiedAt is null for never-studied packs. */
  createdAt: string;
  updatedAt: string;
  lastStudiedAt: string | null;
}

interface Folder {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  decks: Deck[];
}

// ── Library sort ─────────────────────────────────────────────────
// The home page lets the user pick how their packs are ordered.
// Persisted to localStorage so a returning user keeps the choice
// across sessions. Sort applies to BOTH the unfoldered list AND
// each folder's internal deck list — folders are just containers,
// it'd be confusing if their internals followed a different rule.

type SortKey =
  | "modified-desc"
  | "modified-asc"
  | "reviewed-desc"
  | "reviewed-asc"
  | "name-asc"
  | "name-desc";

const SORT_LABELS: Record<SortKey, string> = {
  "modified-desc": "Recently modified",
  "modified-asc": "Oldest modified",
  "reviewed-desc": "Recently reviewed",
  "reviewed-asc": "Oldest reviewed",
  "name-asc": "Name (A → Z)",
  "name-desc": "Name (Z → A)",
};

const SORT_STORAGE_KEY = "huella-home-sort";

function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: "asc" | "desc",
): number {
  // Nulls always sort last regardless of direction — a never-reviewed
  // pack appearing at the top of "oldest reviewed" would be a UX
  // surprise (the user expected real "oldest" results).
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

interface HomePageProps {
  dailyStudy?: DailyStudySummary | null;
  folders: Folder[];
  unfolderedDecks: Deck[];
  totalCards: number;
  userName?: string;
  cardsReviewedToday: number;
  dailyGoal: number;
  streak: number;
  goalHitCelebrationShown: boolean;
  /** True once the user has clicked through the FirstTimeWelcome
   *  flow at least once (either accepting the starter pack or
   *  skipping it). Once true, we never re-show the multi-step
   *  welcome — even if the user has zero decks — because otherwise
   *  a user who picked "I'd rather build my own" gets dropped back
   *  into the welcome on the next render and is stuck in a loop. */
  onboardingCompleted: boolean;
}

export function HomePage({
  dailyStudy,
  folders,
  unfolderedDecks,
  totalCards,
  userName,
  cardsReviewedToday,
  dailyGoal,
  streak,
  goalHitCelebrationShown,
  onboardingCompleted,
}: HomePageProps) {
  const hasDecks =
    folders.some((f) => f.decks.length > 0) || unfolderedDecks.length > 0;

  // Library sort order. SSR-safe — default to "modified-desc" which
  // matches the server's existing orderBy so the first paint stays
  // identical for new users and we hydrate to the user's preference
  // once localStorage is readable.
  const [sortKey, setSortKey] = useState<SortKey>("modified-desc");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY);
      if (saved && saved in SORT_LABELS) {
        setSortKey(saved as SortKey);
      }
    } catch {
      // localStorage blocked (private mode, storage quota) — silently
      // fall back to the default sort order.
    }
  }, []);
  function updateSort(next: SortKey) {
    setSortKey(next);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next);
    } catch {
      // Same as above — non-fatal if persistence fails.
    }
  }

  // Apply the sort to every list the user can scan: the unfoldered
  // packs at the bottom of the library AND each folder's internal
  // deck list. Wrapping in useMemo keeps the result stable when only
  // unrelated state changes.
  const sortedUnfoldered = useMemo(
    () => sortDecks(unfolderedDecks, sortKey),
    [unfolderedDecks, sortKey],
  );
  const sortedFolders = useMemo(
    () =>
      folders.map((folder) => ({
        ...folder,
        decks: sortDecks(folder.decks, sortKey),
      })),
    [folders, sortKey],
  );

  // Brand-new user → tutorial-style welcome. Only triggers if the
  // user has NEVER been through onboarding AND has zero decks.
  //
  // Two guards (both must hold) instead of just `!onboardingCompleted`:
  //   1. Catches users created BEFORE the onboardingCompletedAt
  //      column existed — their timestamp is null but they obviously
  //      shouldn't be greeted as new. (Reported in production: a
  //      user with 8 packs kept seeing "Lovely to meet you, Massi"
  //      on every sign-in.) A backfill migration also fixes the
  //      historical rows, but defending in code keeps us safe if a
  //      future code path forgets to set the timestamp.
  //   2. !onboardingCompleted alone would bounce the "I'd rather
  //      build my own" user back into the welcome flow after
  //      router.refresh (stuck "Setting up your library…" button
  //      with no escape). That fix still holds — the !hasDecks half
  //      of the AND below ensures they land on the empty-library
  //      hero instead.
  //
  // Must come AFTER all hook calls so React's rules of hooks aren't
  // violated by the early return path.
  if (!onboardingCompleted && !hasDecks) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <FirstTimeWelcome userName={userName || "there"} />
      </div>
    );
  }

  // Onboarded but empty library — happens when the user picked
  // "I'd rather build my own" on the welcome flow, or when an
  // established user deletes every deck. Show a warm empty-state
  // with the CreateMenu front and centre so they can make their
  // first pack without bouncing back through the welcome.
  if (!hasDecks) {
    return (
      <div className="reveal min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-xl text-center space-y-6">
          <div className="text-5xl" aria-hidden>📚</div>
          <h1 className="font-editorial text-3xl font-medium leading-tight text-foreground sm:text-4xl">
            Your library&apos;s ready,{" "}
            <span className="italic text-[color:var(--primary)]">{userName}</span>.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Drop in your first pack and you&apos;ll be studying inside a minute.
            Paste any text, upload a file, pick a topic, or import from Anki —
            whatever&apos;s easiest.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <CreateMenu />
            <Link href="/archive" className="text-sm underline">Archived packs</Link>
          </div>
        </div>
      </div>
    );
  }

  const goalHit = cardsReviewedToday >= dailyGoal;
  const progressPct = Math.min((cardsReviewedToday / dailyGoal) * 100, 100);
  return (
    <div className="space-y-7 sm:space-y-9">
      <section aria-label="Daily study" className="space-y-4">
        <h1 className="sr-only">Your daily study</h1>
        <DailyStudyButton summary={dailyStudy} />
        <div className="space-y-2 px-1">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
            <p className="text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">{cardsReviewedToday} / {dailyGoal}</span> reviewed today
              {goalHit && <span className="ml-2 text-foreground">✓ Goal reached</span>}
            </p>
            {streak > 0 && <p className="text-muted-foreground">{streak}-day streak</p>}
          </div>
          <div role="progressbar" aria-label="Daily review goal" aria-valuemin={0} aria-valuemax={dailyGoal} aria-valuenow={Math.min(cardsReviewedToday,dailyGoal)} className="h-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary" style={{width: `${progressPct}%`}} />
          </div>
          <Link href="/study" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">Choose packs &amp; study settings</Link>
        </div>
      </section>

        {/* ── Library ─────────────────────────────────────────────── */}
        {hasDecks && (
          <section
            className="space-y-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <h2 className="font-editorial text-2xl font-medium text-foreground">Library</h2>
                <span className="text-xs text-muted-foreground">{totalCards.toLocaleString()} cards</span>
                <CreateMenu />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/archive" className="text-sm text-muted-foreground underline hover:text-foreground">Archived packs</Link>
                {/* Sort dropdown — applies to both the unfoldered
                 *  list and each folder's contents. Choice persists
                 *  to localStorage via updateSort(). */}
                <label className="flex items-center gap-2 text-xs">
                  <span className="label-caps">Sort</span>
                  <select
                    value={sortKey}
                    onChange={(e) => updateSort(e.target.value as SortKey)}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground transition-colors hover:border-[color:var(--primary)]/40 focus:border-[color:var(--primary)] focus:outline-none"
                    aria-label="Sort library by"
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                      <option key={key} value={key}>
                        {SORT_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="label-caps shrink-0">
                  {sortedFolders.filter((f) => f.decks.length > 0).length +
                    (sortedUnfoldered.length > 0 ? 1 : 0)}{" "}
                  {sortedFolders.filter((f) => f.decks.length > 0).length +
                    (sortedUnfoldered.length > 0 ? 1 : 0) ===
                  1
                    ? "section"
                    : "sections"}
                </p>
              </div>
            </div>

            <div className="space-y-10">
              {sortedFolders.map(
                (folder) =>
                  folder.decks.length > 0 && (
                    <FolderGroup
                      key={folder.id}
                      name={folder.name}
                      emoji={folder.emoji}
                      color={folder.color}
                      decks={folder.decks}
                    />
                  )
              )}

              {sortedUnfoldered.length > 0 && (
                <div className="space-y-4">
                  {sortedFolders.some((f) => f.decks.length > 0) && (
                    <div className="flex items-baseline gap-3">
                      <p className="label-caps">Uncategorised</p>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  {/* Single-column dense list. flex-col instead of
                   *  grid because grid items default to min-width:auto,
                   *  which lets a long pack name blow past the viewport
                   *  on iPhone and create a horizontal scroll. */}
                  <div className="flex w-full min-w-0 flex-col gap-2">
                    {sortedUnfoldered.map((deck, i) => (
                      <div
                        key={deck.id}
                        className="reveal w-full min-w-0"
                        style={
                          {
                            "--delay": `${200 + i * 35}ms`,
                          } as React.CSSProperties
                        }
                      >
                        <DeckCard
                          id={deck.id}
                          name={deck.name}
                          emoji={deck.emoji}
                          cardCount={deck._count.cards}
                          grade={deck.grade}
                          lastStudiedAt={deck.lastStudiedAt}
                          createdAt={deck.createdAt}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      {/* First-time celebration when user hits their daily goal */}
      <GoalCelebrationDialog
        show={goalHit && !goalHitCelebrationShown}
        dailyGoal={dailyGoal}
      />
    </div>
  );
}
