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

/**
 * Single-line pack card. Compact by design so the user sees as many
 * packs per screen as possible — emoji, title, card count, and grade
 * status are all on one row. Replaces the old two-zone card whose
 * header/footer split wasted vertical space.
 */
export function DeckCard({
  id,
  name,
  emoji,
  cardCount,
  grade,
  folderColor,
  lastStudiedAt,
}: DeckCardProps) {
  const isStudied = grade !== "New";
  const gradeLabel = isStudied ? grade : "New";

  return (
    // `block w-full min-w-0`: keep the Link from expanding past its
    // grid/flex parent when the title is long. Without min-w-0 the
    // truncate inside doesn't apply because the parent's intrinsic
    // min-width still respects content width — caused the home page
    // to scroll horizontally on iPhone width.
    <Link href={`/decks/${id}`} className="block w-full min-w-0">
      <article className="editorial-card group relative flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-[color:var(--primary)]/40 sm:px-4">
        {/* Folder-color spine */}
        {folderColor && (
          <div
            aria-hidden
            className="absolute left-0 top-0 h-full w-[3px]"
            style={{ backgroundColor: folderColor }}
          />
        )}

        {/* Emoji — fixed-width slot so titles align across rows */}
        <span
          aria-hidden
          className="shrink-0 text-lg leading-none opacity-80 transition-opacity group-hover:opacity-100"
        >
          {emoji || "📚"}
        </span>

        {/* Title — takes all remaining space, truncates on overflow */}
        <h3 className="min-w-0 flex-1 truncate font-editorial text-base font-medium leading-tight text-card-foreground transition-colors group-hover:text-[color:var(--primary)]">
          {name}
        </h3>

        {/* Meta — right-aligned, all inline. Mobile shows just the
         *  count + grade dot to keep the row from breaking on iPhone
         *  width. Tablet+ adds the grade letter and last-studied. */}
        <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
          {lastStudiedAt && (
            <>
              <span className="hidden md:inline">
                {formatRelative(lastStudiedAt)}
              </span>
              <span
                aria-hidden
                className="hidden h-1 w-1 rounded-full bg-muted-foreground/40 md:inline-block"
              />
            </>
          )}
          <span>{cardCount}</span>
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: gradeColor(grade as LetterGrade) }}
          />
          <span className="hidden sm:inline">{gradeLabel}</span>
        </div>
      </article>
    </Link>
  );
}
