"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card as CardUI, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownItem } from "@/components/ui/dropdown-menu";
import { AnkiExportButton } from "@/components/export/anki-export-button";
import { type LetterGrade, gradeColor } from "@/lib/sm2";

interface CardData {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  tags: string | null;
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

  async function handleDelete() {
    if (!confirm("Delete this pack and all its cards? This cannot be undone.")) return;
    await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const now = new Date();
  const dueCards = deck.cards.filter(
    (c) => new Date(c.nextReviewAt) <= now
  ).length;

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
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>{deck._count.cards} cards</span>
            {dueCards > 0 && (
              <Badge variant="warning">{dueCards} due for review</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {deck.cards.length > 0 && (
            <Link href={`/decks/${deck.id}/study`}>
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <span className="text-4xl mb-3">{"\ud83c\udccf"}</span>
          <h2 className="text-lg font-semibold">No cards yet</h2>
          <p className="text-muted-foreground mt-1">
            Add cards manually or generate them with AI
          </p>
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
