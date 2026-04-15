"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface DeckCardProps {
  id: string;
  name: string;
  emoji: string | null;
  cardCount: number;
  dueCount: number;
  folderColor?: string | null;
}

export function DeckCard({ id, name, emoji, cardCount, dueCount, folderColor }: DeckCardProps) {
  const masteryPercent = cardCount > 0 ? Math.round(((cardCount - dueCount) / cardCount) * 100) : 0;

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
            <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
              {name}
            </h3>
          </div>
          {dueCount > 0 && (
            <Badge variant="warning">{dueCount} due</Badge>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{cardCount} cards</span>
            <span>{masteryPercent}% mastered</span>
          </div>
          <Progress value={masteryPercent} className="h-1.5" />
        </div>
      </div>
    </Link>
  );
}
