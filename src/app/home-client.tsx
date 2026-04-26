"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreateMenu } from "@/components/home/create-menu";
import { FolderGroup } from "@/components/home/folder-group";
import { DeckCard } from "@/components/deck/deck-card";
import { Button } from "@/components/ui/button";
import { GoalCelebrationDialog } from "@/components/home/goal-celebration-dialog";

interface Deck {
  id: string;
  name: string;
  emoji: string | null;
  _count: { cards: number };
  grade: string;
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
        <header
          className="reveal flex items-start justify-between gap-4 pb-2"
          style={{ "--delay": "0ms" } as React.CSSProperties}
        >
          <div>
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
          <CreateMenu />
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

        {/* ── Empty state (no decks yet) ──────────────────────────── */}
        {!hasDecks && (
          <section
            className="reveal"
            style={{ "--delay": "80ms" } as React.CSSProperties}
          >
            <div className="relative overflow-hidden rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center sm:px-10">
              <p className="label-caps">Your library</p>
              <h2 className="font-editorial mt-3 text-3xl font-medium text-foreground sm:text-4xl">
                An empty bookshelf,{" "}
                <span className="italic text-[color:var(--primary)]">
                  waiting.
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                Paste any text, upload a PDF, or import an existing Anki deck.
                FlashMind turns it into flashcards with an AI illustration on
                every card.
              </p>
              <div className="mt-6 inline-flex items-center gap-3">
                <CreateMenu />
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
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <h2 className="font-editorial text-2xl font-medium text-foreground">
                Library
              </h2>
              <p className="label-caps">
                {folders.filter((f) => f.decks.length > 0).length +
                  (unfolderedDecks.length > 0 ? 1 : 0)}{" "}
                {folders.filter((f) => f.decks.length > 0).length +
                  (unfolderedDecks.length > 0 ? 1 : 0) ===
                1
                  ? "section"
                  : "sections"}
              </p>
            </div>

            <div className="space-y-10">
              {folders.map(
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

              {unfolderedDecks.length > 0 && (
                <div className="space-y-4">
                  {folders.some((f) => f.decks.length > 0) && (
                    <div className="flex items-baseline gap-3">
                      <p className="label-caps">Uncategorised</p>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {unfolderedDecks.map((deck, i) => (
                      <div
                        key={deck.id}
                        className="reveal"
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
