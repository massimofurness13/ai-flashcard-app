"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreateMenu } from "@/components/home/create-menu";
import { FolderGroup } from "@/components/home/folder-group";
import { DeckCard } from "@/components/deck/deck-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalCelebrationDialog } from "@/components/home/goal-celebration-dialog";

interface Deck {
  id: string;
  name: string;
  emoji: string | null;
  _count: { cards: number };
  grade: string;
  lastStudiedAt?: string | null;
}

interface Folder {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  decks: Deck[];
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
}

type SortKey = "recent" | "alpha" | "grade" | "size";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Last studied" },
  { key: "alpha", label: "A → Z" },
  { key: "grade", label: "Grade" },
  { key: "size", label: "Size" },
];

// Higher = stronger. Used for the Grade sort order.
const GRADE_RANK: Record<string, number> = {
  A: 6,
  B: 5,
  C: 4,
  D: 3,
  F: 2,
  New: 1,
};

function sortDecks(decks: Deck[], key: SortKey): Deck[] {
  const copy = [...decks];
  switch (key) {
    case "recent":
      // Null lastStudied goes to the end, otherwise most-recent first.
      return copy.sort((a, b) => {
        const ta = a.lastStudiedAt ? new Date(a.lastStudiedAt).getTime() : 0;
        const tb = b.lastStudiedAt ? new Date(b.lastStudiedAt).getTime() : 0;
        return tb - ta;
      });
    case "alpha":
      return copy.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
    case "grade":
      return copy.sort(
        (a, b) => (GRADE_RANK[b.grade] ?? 0) - (GRADE_RANK[a.grade] ?? 0)
      );
    case "size":
      return copy.sort((a, b) => b._count.cards - a._count.cards);
  }
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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
}: HomePageProps) {
  const hasDecks =
    folders.some((f) => f.decks.length > 0) || unfolderedDecks.length > 0;
  // Compute greeting only after hydration — server + client timezones may
  // differ, which would cause a React hydration mismatch (error #418).
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => setGreeting(getGreeting()), []);

  // Sort preference persists in localStorage so it survives reloads.
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  useEffect(() => {
    const saved = localStorage.getItem("flashmind-deck-sort") as SortKey | null;
    if (saved && SORT_OPTIONS.some((o) => o.key === saved)) {
      setSortKey(saved);
    }
  }, []);
  function changeSort(next: SortKey) {
    setSortKey(next);
    localStorage.setItem("flashmind-deck-sort", next);
  }

  const sortedFolders = useMemo(
    () => folders.map((f) => ({ ...f, decks: sortDecks(f.decks, sortKey) })),
    [folders, sortKey]
  );
  const sortedUnfoldered = useMemo(
    () => sortDecks(unfolderedDecks, sortKey),
    [unfolderedDecks, sortKey]
  );

  const goalHit = cardsReviewedToday >= dailyGoal;
  const progressPct = Math.min((cardsReviewedToday / dailyGoal) * 100, 100);
  const remaining = Math.max(dailyGoal - cardsReviewedToday, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, {userName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCards} total cards
          </p>
        </div>
        <CreateMenu />
      </div>

      {/* Today's study — daily goal + streak */}
      {hasDecks && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium">Today&apos;s study</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {goalHit
                    ? "You've hit your daily goal — nicely done."
                    : `${cardsReviewedToday} of ${dailyGoal} cards so far`}
                </p>
              </div>
              {streak > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span>🔥</span>
                  <span className="font-semibold">{streak}</span>
                  <span className="text-muted-foreground">
                    day{streak === 1 ? "" : "s"}
                  </span>
                </div>
              )}
            </div>

            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {goalHit ? (
                  "Great work. Come back tomorrow to keep the streak alive."
                ) : (
                  <>
                    {remaining} card{remaining === 1 ? "" : "s"} to go
                  </>
                )}
              </span>
              <Link
                href={
                  goalHit
                    ? "/study"
                    : `/study?filter=due&limit=${remaining}`
                }
              >
                <Button size="sm" variant={goalHit ? "outline" : "default"}>
                  {goalHit ? "Study more" : "Start today's session"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasDecks ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <span className="text-5xl mb-4">{"\ud83d\udcda"}</span>
          <h2 className="text-lg font-semibold">No packs yet</h2>
          <p className="text-muted-foreground mt-1 max-w-sm">
            Create your first flashcard pack to get started learning.
            You can create them manually or generate them with AI.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sort control */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {SORT_OPTIONS.map((opt) => (
                <Button
                  key={opt.key}
                  variant={sortKey === opt.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => changeSort(opt.key)}
                  className="h-7 text-xs"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <Link
              href="/archive"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Archive →
            </Link>
          </div>

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
            <div className="space-y-3">
              {folders.some((f) => f.decks.length > 0) && (
                <h2 className="text-lg font-semibold text-foreground">
                  Uncategorized
                </h2>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortedUnfoldered.map((deck) => (
                  <DeckCard
                    key={deck.id}
                    id={deck.id}
                    name={deck.name}
                    emoji={deck.emoji}
                    cardCount={deck._count.cards}
                    grade={deck.grade}
                    lastStudiedAt={deck.lastStudiedAt}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* First-time celebration when user hits their daily goal */}
      <GoalCelebrationDialog
        show={goalHit && !goalHitCelebrationShown}
        dailyGoal={dailyGoal}
      />
    </div>
  );
}
