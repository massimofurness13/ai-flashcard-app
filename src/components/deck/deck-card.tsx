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
  lastStudiedAt?: string | null;
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function DeckCard({
  id,
  name,
  emoji,
  cardCount,
  grade,
  folderColor,
  lastStudiedAt,
}: DeckCardProps) {
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
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">{emoji || "\ud83d\udcda"}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors truncate">
                {name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cardCount} {cardCount === 1 ? "card" : "cards"}
                {lastStudiedAt && (
                  <>
                    <span className="mx-1.5">·</span>
                    {formatRelative(lastStudiedAt)}
                  </>
                )}
              </p>
            </div>
          </div>
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: gradeColor(grade as LetterGrade) }}
          >
            {grade === "New" ? "?" : grade}
          </div>
        </div>
      </div>
    </Link>
  );
}
