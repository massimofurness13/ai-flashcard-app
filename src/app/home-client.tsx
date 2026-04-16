"use client";

import { CreateMenu } from "@/components/home/create-menu";
import { FolderGroup } from "@/components/home/folder-group";
import { DeckCard } from "@/components/deck/deck-card";

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
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomePage({ folders, unfolderedDecks, totalCards, userName }: HomePageProps) {
  const hasDecks = folders.some((f) => f.decks.length > 0) || unfolderedDecks.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {getGreeting()}, {userName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCards} total cards
          </p>
        </div>
        <CreateMenu />
      </div>

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
        <div className="space-y-6">
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
            <div className="space-y-3">
              {folders.some((f) => f.decks.length > 0) && (
                <h2 className="text-lg font-semibold text-foreground">
                  Uncategorized
                </h2>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {unfolderedDecks.map((deck) => (
                  <DeckCard
                    key={deck.id}
                    id={deck.id}
                    name={deck.name}
                    emoji={deck.emoji}
                    cardCount={deck._count.cards}
                    grade={deck.grade}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
