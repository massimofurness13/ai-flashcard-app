"use client";

import Link from "next/link";
import { useState } from "react";
import { invalidateDeviceQueries } from "@/hooks/use-device-query";
import { setPackArchived } from "@/lib/archive-pack";
import { gradeColor, type LetterGrade } from "@/lib/sm2";

interface DeckCardProps {
  id: string;
  name: string;
  emoji: string | null;
  cardCount: number;
  grade: string;
  folderColor?: string | null;
  /** ISO timestamp of the most recent review of any card in this
   *  pack. Null when the pack has never been studied. */
  lastStudiedAt?: string | null;
  /** ISO timestamp of when the pack was first created. Shown in the
   *  metadata row as "created Nd ago". Optional so older call sites
   *  (and the few tests that hand-roll deck props) keep working. */
  createdAt?: string | null;
}

/**
 * Compact relative-time formatter. Short units ("3d", "2w", "6mo")
 * fit comfortably on the second metadata row of a deck card without
 * pushing layout to two-line wrapping. Tradeoff: less natural to
 * read out loud than "3 days ago" but visually denser.
 */
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
 * Two-line pack card. Title + grade indicator on top row; card
 * count, last-reviewed, and created-at on a metadata row beneath.
 * The metadata row earns the extra vertical space by giving users
 * the "should I study this next?" context they need to scan their
 * library — without it they had to click into every pack to see
 * when they'd last reviewed it.
 */
export function DeckCard({
  id,
  name,
  emoji,
  cardCount,
  grade,
  folderColor,
  lastStudiedAt,
  createdAt,
}: DeckCardProps) {
  const [archiving, setArchiving] = useState(false);
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function archivePack() {
    if (archiving) return;
    setArchiving(true);
    setError(null);
    try {
      await setPackArchived(id, true);
      setArchived(true);
      invalidateDeviceQueries();
    } catch {
      setError("Couldn't archive this pack. Please try again.");
    } finally {
      setArchiving(false);
    }
  }
  if (archived) return null;
  const isStudied = grade !== "New";
  const gradeLabel = isStudied ? grade : "New";

  return (
    // `block w-full min-w-0`: keep the Link from expanding past its
    // grid/flex parent when the title is long. Without min-w-0 the
    // truncate inside doesn't apply because the parent's intrinsic
    // min-width still respects content width — caused the home page
    // to scroll horizontally on iPhone width.
      <article className="editorial-card group relative w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-[color:var(--primary)]/40">
        <div className="flex min-w-0 items-center">
        <Link href={`/decks/${id}`} prefetch={true} className="block min-w-0 flex-1 px-3 py-2.5 sm:px-4">
        {/* Folder-color spine */}
        {folderColor && (
          <div
            aria-hidden
            className="absolute left-0 top-0 h-full w-[3px]"
            style={{ backgroundColor: folderColor }}
          />
        )}

        {/* Title row — emoji + name + grade indicator on the right. */}
        <div className="flex w-full min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="shrink-0 text-lg leading-none opacity-80 transition-opacity group-hover:opacity-100"
          >
            {emoji || "📚"}
          </span>

          <h3 className="min-w-0 flex-1 truncate font-editorial text-base font-medium leading-tight text-card-foreground transition-colors group-hover:text-[color:var(--primary)]">
            {name}
          </h3>

          <div className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: gradeColor(grade as LetterGrade) }}
            />
            <span className="hidden sm:inline">{gradeLabel}</span>
          </div>
        </div>

        {/* Metadata row — card count, last-reviewed, created. Each
         *  piece is interpunct-separated so a deck never studied
         *  reads "12 cards · never reviewed · created 3d ago"
         *  rather than dropping fields and shifting alignment.
         *  Indented to align with the title so the eye reads it as
         *  a continuation of the row above, not a sibling block. */}
        <div className="mt-1.5 flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-[28px] text-[11px] text-muted-foreground/85">
          <span>
            {cardCount} {cardCount === 1 ? "card" : "cards"}
          </span>
          <span aria-hidden className="opacity-50">·</span>
          <span>
            {lastStudiedAt
              ? `reviewed ${formatRelative(lastStudiedAt)}`
              : "never reviewed"}
          </span>
          {createdAt && (
            <>
              <span aria-hidden className="opacity-50">·</span>
              <span>created {formatRelative(createdAt)}</span>
            </>
          )}
        </div>
        </Link>
        <button
          type="button"
          aria-label={`Archive ${name}`}
          title="Hide this pack from your library and study sessions. Cards and progress are kept."
          onClick={archivePack}
          disabled={archiving}
          className="mr-2 min-h-11 shrink-0 rounded-lg px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-foreground disabled:opacity-50"
        >
          {archiving ? "Archiving…" : "Archive"}
        </button>
        </div>
        {error && <p role="alert" className="px-3 pb-2 text-xs text-destructive">{error}</p>}
      </article>
  );
}
