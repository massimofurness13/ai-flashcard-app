"use client";

import Link from "next/link";
import { gradeColor, type LetterGrade } from "@/lib/sm2";

interface DeckCardProps {
  id: string;
  name: string;
  emoji: string | null;
  cardCount: number;
  grade: string;
  folderColor?: string | null;
}

export function DeckCard({ id, name, emoji, cardCount, grade, folderColor }: DeckCardProps) {
  return (
    <Link href={`/decks/${id}`}>
      <div className="group relative rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30">
        {folderColor && (
          <div
            className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
            style={{ backgroundColor: folderColor }}
          />
        )}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{emoji || "\ud83d\udcda"}</span>
            <div>
              <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
                {name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cardCount} {cardCount === 1 ? "card" : "cards"}
              </p>
            </div>
          </div>
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: gradeColor(grade as LetterGrade) }}
          >
            {grade === "New" ? "?" : grade}
          </div>
        </div>
      </div>
    </Link>
  );
}
