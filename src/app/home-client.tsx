"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreateMenu } from "@/components/home/create-menu";
import { FolderGroup } from "@/components/home/folder-group";
import { DeckCard } from "@/components/deck/deck-card";
import { Button } from "@/components/ui/button";
import { GoalCelebrationDialog } from "@/components/home/goal-celebration-dialog";
import { FirstTimeWelcome } from "@/components/home/first-time-welcome";

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Picks the celebration phrase shown when the daily goal is hit.
// Rotates through a small pool seeded by today's date so the phrase
// is stable for the whole day but changes day-to-day. Streak-aware
// variants only enter the pool once the user has at least a 2-day
// run — "1 for 1" reads awkwardly, and the generic ones don't add
// much on a fresh streak.
function getCelebrationPhrase(streak: number): string {
  const warm = [
    "Nicely done.",
    "Solid work.",
    "Well played.",
    "That'll do nicely.",
    "Bang on.",
  ];
  const streakAware =
    streak >= 2
      ? [
          `${streak} for ${streak}.`,
          `Day ${streak}, locked in.`,
          "Building the habit.",
          "Sticking with it.",
        ]
      : [];
  const pool = [...warm, ...streakAware];
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return pool[seed % pool.length];
}

export function HomePage({
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

  // Compute greeting + date client-side to avoid SSR timezone mismatch
  // (React hydration error #418 if we render time-dependent text on server).
  const [greeting, setGreeting] = useState("Hello");
  const [today, setToday] = useState("");
  useEffect(() => {
    setGreeting(getGreeting());
    setToday(getTodayLabel());
  }, []);

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
  // unrelated state changes (e.g. greeting hydration above).
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
          </div>
        </div>
      </div>
    );
  }

  const goalHit = cardsReviewedToday >= dailyGoal;
  const progressPct = Math.min((cardsReviewedToday / dailyGoal) * 100, 100);
  const remaining = Math.max(dailyGoal - cardsReviewedToday, 0);

  // Progress-ring geometry. r=46 on a 100×100 viewBox leaves 4px padding
  // for the stroke. Circumference drives the dash animation.
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressPct / 100);

  return (
    <div className="relative">
      {/* Notebook margin — a faint vertical rule down the left of the
       * content column on wide screens. Small detail, big contribution
       * to the "considered editorial" feel. Hidden on mobile where
       * screen width makes it compete with chrome. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 hidden h-full w-px bg-border opacity-50 md:block"
        style={{ left: "-1.5rem" }}
      />

      <div className="space-y-12 sm:space-y-14">
        {/* ── Masthead ────────────────────────────────────────────── */}
        {/* min-w-0 on the title wrapper + shrink-0 on the CreateMenu
         *  wrapper: keeps the "+ New" button fully inside the viewport
         *  even when the username is long. Without shrink-0 the title
         *  was crowding the button against the right edge on mobile. */}
        <header
          className="reveal flex items-start justify-between gap-3 pb-2"
          style={{ "--delay": "0ms" } as React.CSSProperties}
        >
          <div className="min-w-0 flex-1">
            <p className="label-caps">{today}</p>
            <h1 className="font-editorial mt-2 text-4xl font-medium leading-[1.05] text-foreground sm:text-5xl">
              {greeting},{" "}
              <span className="italic text-[color:var(--primary)]">
                {userName}
              </span>
              .
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {totalCards.toLocaleString()} cards in your library
              {streak > 0 && (
                <>
                  <span className="mx-2 text-border">·</span>
                  <span className="text-foreground">{streak}-day streak</span>
                </>
              )}
            </p>
          </div>
          <div className="shrink-0">
            <CreateMenu />
          </div>
        </header>

        {/* ── Today's study — editorial hero with progress ring ───── */}
        {hasDecks && (
          <section
            className="reveal"
            style={{ "--delay": "80ms" } as React.CSSProperties}
          >
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-8 sm:px-10 sm:py-10">
              {/* Ambient warmth — soft primary-tinted gradient in the
               * top-right corner. Gives the page's hero block depth
               * without using imagery. */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in oklch, var(--primary) 40%, transparent), transparent 70%)",
                }}
              />

              <div className="relative flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-4">
                  <p className="label-caps">
                    Today&apos;s study
                    {streak > 0 && (
                      <span className="ml-3 inline-flex items-center gap-1 text-[color:var(--primary)]">
                        <span className="text-sm">🔥</span>
                        <span>
                          {streak} day{streak === 1 ? "" : "s"} running
                        </span>
                      </span>
                    )}
                  </p>

                  <h2 className="font-editorial text-3xl font-medium leading-tight text-foreground sm:text-4xl">
                    {goalHit ? (
                      <>
                        You&apos;re done for today.
                        <br />
                        <span className="italic text-[color:var(--glow)]">
                          {getCelebrationPhrase(streak)}
                        </span>
                      </>
                    ) : remaining === dailyGoal ? (
                      <>
                        Ready for{" "}
                        <span className="italic text-[color:var(--primary)]">
                          {dailyGoal}
                        </span>{" "}
                        cards?
                      </>
                    ) : (
                      <>
                        <span className="italic text-[color:var(--primary)]">
                          {remaining}
                        </span>{" "}
                        {remaining === 1 ? "card" : "cards"} left today.
                      </>
                    )}
                  </h2>

                  <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                    {goalHit
                      ? "You've hit your daily goal. Come back tomorrow to keep the rhythm — or study more now if you're on a roll."
                      : `${cardsReviewedToday} of ${dailyGoal} reviewed so far. Short, steady sessions are what move the needle.`}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Link
                      href={
                        goalHit
                          ? "/study"
                          : `/study?filter=due&limit=${remaining}`
                      }
                    >
                      <Button size="md">
                        {goalHit
                          ? "Study a little more"
                          : cardsReviewedToday > 0
                            ? "Continue today's session"
                            : "Begin today's session"}
                      </Button>
                    </Link>
                    {!goalHit && (
                      <Link
                        href="/study"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        or choose a pack →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Progress ring — distinctive alternative to the
                 * typical horizontal bar. Percent lives inside the ring. */}
                <div className="relative h-32 w-32 shrink-0 sm:h-36 sm:w-36">
                  <svg
                    className="h-full w-full -rotate-90"
                    viewBox="0 0 100 100"
                    aria-hidden
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="none"
                      stroke={goalHit ? "var(--glow)" : "var(--primary)"}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      style={{
                        transition:
                          "stroke-dashoffset 0.9s cubic-bezier(0.2, 0, 0, 1)",
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-editorial text-3xl font-medium leading-none text-foreground sm:text-4xl">
                      {Math.round(progressPct)}
                      <span className="text-lg text-muted-foreground">%</span>
                    </span>
                    <span className="label-caps mt-1">
                      {cardsReviewedToday}/{dailyGoal}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Library ─────────────────────────────────────────────── */}
        {hasDecks && (
          <section
            className="reveal space-y-8"
            style={{ "--delay": "160ms" } as React.CSSProperties}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
              <h2 className="font-editorial text-2xl font-medium text-foreground">
                Library
              </h2>
              <div className="flex items-center gap-3">
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
      </div>

      {/* First-time celebration when user hits their daily goal */}
      <GoalCelebrationDialog
        show={goalHit && !goalHitCelebrationShown}
        dailyGoal={dailyGoal}
      />
    </div>
  );
}
