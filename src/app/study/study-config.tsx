"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CARDS_PER_SESSION_OPTIONS,
  AUTO_FLIP_MAX,
  CARD_ORIENTATION_OPTIONS,
} from "@/lib/constants";

type StudyFilter = "due" | "random" | "created" | "mastery" | "recent" | "alpha";

const FILTER_OPTIONS: { value: StudyFilter; label: string; description: string }[] = [
  { value: "due", label: "Due for review", description: "Cards that are due based on spaced repetition (recommended)" },
  { value: "random", label: "Random", description: "A random sample from the selected packs" },
  { value: "mastery", label: "Needs practice", description: "Cards with the lowest mastery first" },
  { value: "created", label: "Created order", description: "Oldest cards first, in the order you added them" },
  { value: "recent", label: "Recently added", description: "Newest cards first" },
  { value: "alpha", label: "Alphabetical", description: "Sorted by the card's front text, A to Z" },
];

interface Deck {
  id: string;
  name: string;
  emoji: string | null;
  _count: { cards: number };
}

interface StudyConfigProps {
  decks: Deck[];
}

export function StudyConfig({ decks }: StudyConfigProps) {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
      <StudyConfigInner decks={decks} />
    </Suspense>
  );
}

function StudyConfigInner({ decks }: StudyConfigProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill pack and filter from URL (e.g. from deck-view "Study" button)
  const preselectedDeckIds = searchParams.get("deckIds")?.split(",").filter(Boolean);
  const preselectedFilter = searchParams.get("filter") as StudyFilter | null;

  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>(
    preselectedDeckIds && preselectedDeckIds.length > 0
      ? preselectedDeckIds
      : decks.map((d) => d.id)
  );
  const [filter, setFilter] = useState<StudyFilter>(preselectedFilter || "due");
  const [cardsPerSession, setCardsPerSession] = useState(25);
  const [customCards, setCustomCards] = useState("");
  const [isCustomCards, setIsCustomCards] = useState(false);
  const [autoFlip, setAutoFlip] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(0);
  const [orientation, setOrientation] = useState<"front" | "back" | "mixed">("front");

  const totalCards = decks
    .filter((d) => selectedDeckIds.includes(d.id))
    .reduce((sum, d) => sum + d._count.cards, 0);

  // If URL said "autoStart", skip straight to session with the pre-selected params
  useEffect(() => {
    if (searchParams.get("autoStart") === "true" && preselectedDeckIds?.length) {
      const params = new URLSearchParams({
        deckIds: preselectedDeckIds.join(","),
        limit: "25",
        filter: preselectedFilter || "due",
        autoFlip: "0",
        autoAdvance: "0",
        orientation: "front",
      });
      router.replace(`/study/session?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleDeck(deckId: string) {
    setSelectedDeckIds((prev) =>
      prev.includes(deckId) ? prev.filter((id) => id !== deckId) : [...prev, deckId]
    );
  }

  function startStudy() {
    const params = new URLSearchParams({
      deckIds: selectedDeckIds.join(","),
      limit: String(cardsPerSession),
      filter,
      autoFlip: String(autoFlip),
      autoAdvance: String(autoAdvance),
      orientation,
    });
    router.push(`/study/session?${params.toString()}`);
  }

  const activeFilter = FILTER_OPTIONS.find((f) => f.value === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Study</h1>
        <p className="text-muted-foreground mt-1">
          Pick what you want to study. Every rating updates your progress.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Which packs?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {decks.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No packs created yet. Create a pack first!
              </p>
            ) : (
              decks.map((deck) => (
                <label
                  key={deck.id}
                  className="flex items-center gap-3 rounded-lg p-3 hover:bg-accent cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDeckIds.includes(deck.id)}
                    onChange={() => toggleDeck(deck.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-lg">{deck.emoji || "\ud83d\udcda"}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{deck.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {deck._count.cards} cards
                  </span>
                </label>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How should cards be picked?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as StudyFilter)}
            className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {activeFilter && (
            <p className="text-xs text-muted-foreground">{activeFilter.description}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Cards per session</label>
            <div className="flex gap-2 flex-wrap">
              {CARDS_PER_SESSION_OPTIONS.map((n) => (
                <Button
                  key={n}
                  variant={!isCustomCards && cardsPerSession === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setCardsPerSession(n);
                    setIsCustomCards(false);
                    setCustomCards("");
                  }}
                >
                  {n}
                </Button>
              ))}
              <Input
                type="number"
                placeholder="Custom"
                value={customCards}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomCards(val);
                  const num = parseInt(val, 10);
                  if (num > 0) {
                    setCardsPerSession(num);
                    setIsCustomCards(true);
                  }
                }}
                className="w-24 h-8 text-sm"
                min={1}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Auto-flip timer: {autoFlip === 0 ? "Off" : `${autoFlip.toFixed(1)}s`}
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Off</span>
              <input
                type="range"
                min={0}
                max={AUTO_FLIP_MAX}
                step={0.1}
                value={autoFlip}
                onChange={(e) => setAutoFlip(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">{AUTO_FLIP_MAX}s</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Auto-advance timer: {autoAdvance === 0 ? "Off" : `${autoAdvance.toFixed(1)}s`}
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Off</span>
              <input
                type="range"
                min={0}
                max={AUTO_FLIP_MAX}
                step={0.1}
                value={autoAdvance}
                onChange={(e) => setAutoAdvance(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">{AUTO_FLIP_MAX}s</span>
            </div>
            {autoAdvance > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Hands-free mode: cards move on automatically. Rating buttons are hidden.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Card orientation</label>
            <div className="flex gap-2">
              {CARD_ORIENTATION_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={orientation === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOrientation(opt.value as typeof orientation)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        disabled={selectedDeckIds.length === 0 || totalCards === 0}
        onClick={startStudy}
      >
        Start Studying
      </Button>
    </div>
  );
}
