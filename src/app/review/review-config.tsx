"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CARDS_PER_SESSION_OPTIONS,
  AUTO_FLIP_MIN,
  AUTO_FLIP_MAX,
  CARD_ORIENTATION_OPTIONS,
} from "@/lib/constants";

interface Deck {
  id: string;
  name: string;
  emoji: string | null;
  dueCount: number;
  _count: { cards: number };
}

interface ReviewConfigProps {
  decks: Deck[];
  totalDue: number;
}

export function ReviewConfig({ decks, totalDue }: ReviewConfigProps) {
  const router = useRouter();
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>(
    decks.filter((d) => d.dueCount > 0).map((d) => d.id)
  );
  const [cardsPerSession, setCardsPerSession] = useState(10);
  const [customCards, setCustomCards] = useState("");
  const [isCustomCards, setIsCustomCards] = useState(false);
  const [autoFlip, setAutoFlip] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(0);
  const [orientation, setOrientation] = useState<"front" | "back" | "mixed">("front");
  const [recencyCutoff, setRecencyCutoff] = useState<number>(0); // 0 = off, otherwise days

  const RECENCY_OPTIONS = [
    { label: "Off", value: 0 },
    { label: "1 day", value: 1 },
    { label: "3 days", value: 3 },
    { label: "1 week", value: 7 },
    { label: "2 weeks", value: 14 },
    { label: "1 month", value: 30 },
  ];

  const selectedDue = decks
    .filter((d) => selectedDeckIds.includes(d.id))
    .reduce((sum, d) => sum + d.dueCount, 0);

  function toggleDeck(deckId: string) {
    setSelectedDeckIds((prev) =>
      prev.includes(deckId)
        ? prev.filter((id) => id !== deckId)
        : [...prev, deckId]
    );
  }

  function startReview() {
    const params = new URLSearchParams({
      deckIds: selectedDeckIds.join(","),
      limit: String(cardsPerSession),
      autoFlip: String(autoFlip),
      autoAdvance: String(autoAdvance),
      orientation,
    });
    if (recencyCutoff > 0) {
      params.set("recencyCutoff", String(recencyCutoff));
    }
    router.push(`/review/session?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review</h1>
        <p className="text-muted-foreground mt-1">
          {totalDue > 0
            ? `${totalDue} cards due for review`
            : "No cards due right now"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Packs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {decks.map((deck) => (
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
                {deck.dueCount > 0 && (
                  <Badge variant="warning">{deck.dueCount} due</Badge>
                )}
              </label>
            ))}
            {decks.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No packs created yet. Create a pack first!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recency Cutoff</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Skip individual cards you&apos;ve reviewed within a certain time period
          </p>
          <div className="flex gap-2 flex-wrap">
            {RECENCY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={recencyCutoff === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setRecencyCutoff(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Cards per session
            </label>
            <div className="flex gap-2 flex-wrap">
              {CARDS_PER_SESSION_OPTIONS.map((n) => (
                <Button
                  key={n}
                  variant={!isCustomCards && cardsPerSession === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setCardsPerSession(n); setIsCustomCards(false); setCustomCards(""); }}
                >
                  {n}
                </Button>
              ))}
              <div className="flex items-center gap-1">
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
                Hands-free mode: cards move on automatically. Rating buttons are hidden —
                no mastery tracking happens while auto-advance is on.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Card orientation
            </label>
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
        disabled={selectedDeckIds.length === 0 || selectedDue === 0}
        onClick={startReview}
      >
        Start Review ({Math.min(selectedDue, cardsPerSession)} cards)
      </Button>
    </div>
  );
}

