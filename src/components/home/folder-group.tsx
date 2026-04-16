"use client";

import { useState } from "react";
import { DeckCard } from "@/components/deck/deck-card";

interface Deck {
  id: string;
  name: string;
  emoji: string | null;
  _count: { cards: number };
  grade: string;
}

interface FolderGroupProps {
  name: string;
  emoji: string | null;
  color: string | null;
  decks: Deck[];
  defaultOpen?: boolean;
}

export function FolderGroup({ name, emoji, color, decks, defaultOpen = true }: FolderGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3">
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen(!open)}
      >
        <svg
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-lg">{emoji || "\ud83d\udcc1"}</span>
        <h2 className="text-lg font-semibold text-foreground">{name}</h2>
        <span className="text-sm text-muted-foreground">
          ({decks.length} {decks.length === 1 ? "pack" : "packs"})
        </span>
      </button>

      {open && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pl-6">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              id={deck.id}
              name={deck.name}
              emoji={deck.emoji}
              cardCount={deck._count.cards}
              grade={deck.grade}
              folderColor={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}
