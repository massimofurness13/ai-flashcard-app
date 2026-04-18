"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card as CardUI, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { AnkiExportButton } from "@/components/export/anki-export-button";
import { type LetterGrade, gradeColor } from "@/lib/sm2";
import { estimateImageGenTime } from "@/lib/utils";

interface CardData {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  tags: string | null;
  imageUrl: string | null;
  nextReviewAt: Date | string;
}

interface GradeDistribution {
  A: number;
  B: number;
  C: number;
  D: number;
  F: number;
  New: number;
}

interface DeckViewProps {
  deck: {
    id: string;
    name: string;
    description: string | null;
    emoji: string | null;
    folder: { id: string; name: string; emoji: string | null } | null;
    cards: CardData[];
    _count: { cards: number };
  };
  overallGrade: LetterGrade;
  avgMastery: number;
  gradeDistribution: GradeDistribution;
  isPro?: boolean;
}

export function DeckView({ deck, overallGrade, avgMastery, gradeDistribution, isPro = false }: DeckViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [generationActive, setGenerationActive] = useState(false);
  const [initialPending, setInitialPending] = useState(0);
  const [kickOffLoading, setKickOffLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const cardsWithoutImages = deck.cards.filter((c) => !c.imageUrl).length;
  const generationKey = `gen-active-${deck.id}`;
  const generationTotalKey = `gen-total-${deck.id}`;

  // Fire-and-forget: tell the server to generate missing images in the
  // background. User can navigate away, close the tab, or keep working.
  async function generateMissingImages(tier: "quick" | "premium" = "quick") {
    if (cardsWithoutImages === 0) return;

    setKickOffLoading(true);
    try {
      const res = await fetch("/api/images/generate-deck-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: deck.id, tier }),
      });
      const data = await res.json();
      if (res.ok && data.queued > 0) {
        const expiresAt = Date.now() + 10 * 60 * 1000;
        sessionStorage.setItem(generationKey, String(expiresAt));
        sessionStorage.setItem(generationTotalKey, String(data.queued));
        setInitialPending(data.queued);
        setGenerationActive(true);
      } else if (!res.ok) {
        alert(data.error || "Could not start image generation.");
      }
    } finally {
      setKickOffLoading(false);
    }
  }

  // On mount, check if we arrived with ?generating=true (from the generate
  // page after save) or if there's an active generation from before.
  useEffect(() => {
    const fromGenerate = searchParams.get("generating") === "true";
    if (fromGenerate) {
      const expiresAt = Date.now() + 10 * 60 * 1000;
      sessionStorage.setItem(generationKey, String(expiresAt));
      sessionStorage.setItem(generationTotalKey, String(cardsWithoutImages));
      setInitialPending(cardsWithoutImages);
      setGenerationActive(true);
      router.replace(`/decks/${deck.id}`);
      return;
    }

    const stored = sessionStorage.getItem(generationKey);
    if (stored) {
      const expiresAt = Number(stored);
      if (expiresAt > Date.now() && cardsWithoutImages > 0) {
        const total = Number(sessionStorage.getItem(generationTotalKey)) || cardsWithoutImages;
        setInitialPending(total);
        setGenerationActive(true);
      } else {
        sessionStorage.removeItem(generationKey);
        sessionStorage.removeItem(generationTotalKey);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll every 5s while generation is active — refreshes the server data
  // so new images appear as they complete. Stops once all cards have
  // images or the 10-minute window expires.
  useEffect(() => {
    if (!generationActive) return;

    function scheduleNext() {
      pollRef.current = setTimeout(() => {
        const stored = sessionStorage.getItem(generationKey);
        const expiresAt = stored ? Number(stored) : 0;
        if (expiresAt <= Date.now()) {
          sessionStorage.removeItem(generationKey);
          sessionStorage.removeItem(generationTotalKey);
          setGenerationActive(false);
          return;
        }
        router.refresh();
        scheduleNext();
      }, 5000);
    }

    scheduleNext();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [generationActive, router, generationKey, generationTotalKey]);

  // When all cards get images, clear the active state
  useEffect(() => {
    if (generationActive && cardsWithoutImages === 0) {
      sessionStorage.removeItem(generationKey);
      sessionStorage.removeItem(generationTotalKey);
      setGenerationActive(false);
    }
  }, [generationActive, cardsWithoutImages, generationKey, generationTotalKey]);

  async function handleDelete() {
    if (!confirm("Delete this pack and all its cards? This cannot be undone.")) return;
    await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {deck.folder && (
              <span className="text-sm text-muted-foreground">
                {deck.folder.emoji} {deck.folder.name} /
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">{deck.emoji || "\ud83d\udcda"}</span>
            {deck.name}
          </h1>
          {deck.description && (
            <p className="text-muted-foreground mt-1">{deck.description}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {deck._count.cards} cards
          </p>
        </div>

        <div className="flex items-center gap-2">
          {deck.cards.length > 0 && isPro && cardsWithoutImages > 0 && !generationActive && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                onClick={() => generateMissingImages("quick")}
                disabled={kickOffLoading}
                title={`Quick (FLUX schnell): ${cardsWithoutImages} credits, ~${estimateImageGenTime(cardsWithoutImages)}`}
              >
                <span className="flex items-center gap-1.5">
                  <span>✨</span>
                  Quick ({cardsWithoutImages})
                </span>
              </Button>
              <Button
                variant="outline"
                onClick={() => generateMissingImages("premium")}
                disabled={kickOffLoading}
                title={`Premium (FLUX dev): ${cardsWithoutImages * 5} credits, ~${estimateImageGenTime(cardsWithoutImages * 2)}`}
              >
                <span className="flex items-center gap-1.5">
                  <span>🎨</span>
                  Premium ({cardsWithoutImages * 5})
                </span>
              </Button>
            </div>
          )}
          {deck.cards.length > 0 && (
            <Link href={`/study?deckIds=${deck.id}&filter=due`}>
              <Button variant="outline">Study</Button>
            </Link>
          )}
          <DropdownMenu
            trigger={
              <Button variant="ghost" size="icon">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </Button>
            }
          >
            <DropdownItem onClick={() => router.push(`/decks/${deck.id}/edit`)}>
              Edit Pack
            </DropdownItem>
            <DropdownItem destructive onClick={handleDelete}>
              Delete Pack
            </DropdownItem>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex gap-2">
        <Link href={`/decks/${deck.id}/cards/new`}>
          <Button>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Card
          </Button>
        </Link>
        <AnkiExportButton
          deckId={deck.id}
          deckName={deck.name}
          isPro={isPro}
          cardCount={deck._count.cards}
        />
      </div>

      {generationActive && (
        <CardUI>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Generating AI images in the background... {Math.max(initialPending - cardsWithoutImages, 0)} / {initialPending}
                </p>
                <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{
                      width: `${(Math.max(initialPending - cardsWithoutImages, 0) / Math.max(initialPending, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              ✨ Feel free to keep working — edit cards, delete some, or navigate anywhere in the app. Images are generating on our server and will appear as they&apos;re ready (estimated time remaining: <span className="font-medium text-foreground">{estimateImageGenTime(cardsWithoutImages)}</span>). AI image generation is still in its infancy and takes a moment per card. Thank you for your patience.
            </p>
          </CardContent>
        </CardUI>
      )}

      {deck.cards.length > 0 && (
        <CardUI>
          <CardHeader>
            <CardTitle>Your Grade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 mb-6">
              <div
                className="flex items-center justify-center w-20 h-20 rounded-2xl text-4xl font-bold text-white"
                style={{ backgroundColor: gradeColor(overallGrade) }}
              >
                {overallGrade === "New" ? "?" : overallGrade}
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {overallGrade === "New"
                    ? "Not yet reviewed"
                    : overallGrade === "A"
                      ? "Excellent fluency"
                      : overallGrade === "B"
                        ? "Good fluency"
                        : overallGrade === "C"
                          ? "Moderate fluency"
                          : overallGrade === "D"
                            ? "Needs practice"
                            : "Just getting started"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {avgMastery}% average mastery across {deck.cards.length} cards
                </p>
              </div>
            </div>

            <p className="text-sm font-medium mb-3">Card Distribution</p>
            <div className="space-y-2">
              {(["A", "B", "C", "D", "F", "New"] as LetterGrade[]).map((grade) => {
                const count = gradeDistribution[grade];
                const pct = deck.cards.length > 0 ? (count / deck.cards.length) * 100 : 0;
                return (
                  <div key={grade} className="flex items-center gap-3">
                    <span
                      className="w-10 text-sm font-bold text-center"
                      style={{ color: gradeColor(grade) }}
                    >
                      {grade}
                    </span>
                    <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: gradeColor(grade),
                          minWidth: count > 0 ? "4px" : "0",
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-8 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CardUI>
      )}

      {deck.cards.length === 0 ? (
        <div className="space-y-4">
          <div className="text-center py-6">
            <span className="text-4xl">{"\ud83c\udccf"}</span>
            <h2 className="text-lg font-semibold mt-3">Let's add some cards</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Choose how you'd like to fill your new pack
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href={`/decks/${deck.id}/cards/new`}>
              <div className="group h-full rounded-xl border-2 border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md hover:bg-primary/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
                  Add cards manually
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Create cards one by one with full control over front, back, hints, and images.
                </p>
              </div>
            </Link>
            <Link href={`/generate?deckId=${deck.id}`}>
              <div className="group h-full rounded-xl border-2 border-primary/40 bg-primary/5 p-6 transition-all hover:border-primary hover:shadow-md hover:bg-primary/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 mb-4 group-hover:bg-primary/25 transition-colors">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
                  Generate cards from text
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Paste lecture notes, a topic, or any text — our AI will automatically create a pack of cards for you.
                </p>
              </div>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {deck.cards.map((card, index) => (
            <Link key={card.id} href={`/decks/${deck.id}/cards/${card.id}/edit`}>
              <div className="group rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30 h-full">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  {card.tags && (
                    <div className="flex gap-1">
                      {card.tags.split(",").slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {card.imageUrl && (
                  <div className="mb-3 flex justify-center">
                    <img
                      src={card.imageUrl}
                      alt=""
                      className="max-h-28 max-w-full object-contain rounded-lg"
                    />
                  </div>
                )}
                <p className="font-medium text-sm line-clamp-2">{card.front}</p>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{card.back}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
