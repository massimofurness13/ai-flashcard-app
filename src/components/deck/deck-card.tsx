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
  const gradeText = grade === "New" ? "Not studied" : `Grade ${grade}`;

  return (
    <Link href={`/decks/${id}`} className="block">
      <article className="editorial-card group relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-border bg-card p-5">
        {/* Folder-color spine */}
        {folderColor && (
          <div
            aria-hidden
            className="absolute left-0 top-0 h-full w-[3px]"
            style={{ backgroundColor: folderColor }}
          />
        )}

        {/* Header — emoji as subtle accent, name as the focal element */}
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 text-xl leading-none opacity-80 transition-opacity group-hover:opacity-100"
          >
            {emoji || "\ud83d\udcda"}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-editorial text-lg font-medium leading-snug text-card-foreground transition-colors group-hover:text-[color:var(--primary)]">
              {name}
            </h3>
            {lastStudiedAt && (
              <p className="label-caps mt-1">
                Last studied {formatRelative(lastStudiedAt)}
              </p>
            )}
          </div>
        </div>

        {/* Footer — metadata row, editorial byline style */}
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-editorial text-lg font-medium text-foreground">
              {cardCount}
            </span>{" "}
            {cardCount === 1 ? "card" : "cards"}
          </p>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: gradeColor(grade as LetterGrade) }}
            />
            <span className="label-caps" style={{ color: "var(--muted-foreground)" }}>
              {gradeText}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
