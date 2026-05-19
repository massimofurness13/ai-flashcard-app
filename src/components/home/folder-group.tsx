"use client";

import { useState } from "react";
import { DeckCard } from "@/components/deck/deck-card";

interface Deck {
  id: string;
  name: string;
  emoji: string | null;
  _count: { cards: number };
  grade: string;
  lastStudiedAt?: string | null;
  /** Deck birth date as an ISO string. Drives the "created Nd ago"
   *  bit of the metadata row inside DeckCard. */
  createdAt?: string | null;
}

interface FolderGroupProps {
  name: string;
  emoji: string | null;
  color: string | null;
  decks: Deck[];
  defaultOpen?: boolean;
}

export function FolderGroup({
  name,
  emoji,
  color,
  decks,
  defaultOpen = true,
}: FolderGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-4">
      {/* Chapter header — typographic, magazine-layout feel. Left rule,
       * small-caps label with a color dot, deck count on the right. */}
      <button
        className="group flex w-full items-baseline gap-3 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {color && (
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 translate-y-[-0.2em] rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        <span aria-hidden className="text-base opacity-70">
          {emoji || "\ud83d\udcc1"}
        </span>
        <h3 className="font-editorial text-xl font-medium text-foreground transition-colors group-hover:text-[color:var(--primary)]">
          {name}
        </h3>
        <div className="h-px flex-1 translate-y-[-0.3em] bg-border" />
        <p className="label-caps shrink-0">
          {decks.length} {decks.length === 1 ? "pack" : "packs"}
          <span className="ml-2 inline-block transition-transform" aria-hidden>
            {open ? "–" : "+"}
          </span>
        </p>
      </button>

      {open && (
        <div className="flex w-full min-w-0 flex-col gap-2">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              id={deck.id}
              name={deck.name}
              emoji={deck.emoji}
              cardCount={deck._count.cards}
              grade={deck.grade}
              folderColor={color}
              lastStudiedAt={deck.lastStudiedAt}
              createdAt={deck.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
