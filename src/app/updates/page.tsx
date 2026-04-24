import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Updates · FlashMind",
};

interface UpdateEntry {
  date: string; // YYYY-MM-DD
  title: string;
  items: string[];
}

/**
 * App changelog. Edit this file to announce new features — it doubles as
 * a retention touch (users come back to see what's new) and a public
 * record of how actively the product is being developed.
 *
 * Keep entries concise. Plain language, no marketing speak.
 */
const UPDATES: UpdateEntry[] = [
  {
    date: "2026-04-21",
    title: "Engagement & stats overhaul",
    items: [
      "Daily study goal with first-time celebration pop-up when you hit it",
      "Streaks — current and longest, visible on home and stats",
      "365-day activity heatmap, GitHub-style",
      "Stats page: Goal Days, Active Days, Best Day, Success Rate, grade distribution, monthly calendar",
      "Deck list: sort by Last Studied / A→Z / Grade / Size, plus last-studied timestamp on every card",
      "Soft-archive for packs you're done with (stats history preserved)",
      "Account: member-since date, sync status, cleaner subscription view, delete account",
      "Help, Contact, About, Updates pages",
    ],
  },
  {
    date: "2026-04-18",
    title: "Faster card transitions",
    items: [
      "Preload the next 5 card images so there's no flash between cards",
      "Year-long cache on image storage — every replay is instant",
    ],
  },
  {
    date: "2026-04-15",
    title: "Unified Study + Review",
    items: [
      "One Study surface for everything, with a filter dropdown (due, random, weakest, newest, recent, alphabetical)",
      "Card-stack deal animation replacing the old flip-reset",
      "Mixed orientation randomised once at session start — no more split-second flashes",
    ],
  },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function UpdatesPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/account"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Account
        </Link>
        <h1 className="font-editorial text-3xl font-medium sm:text-4xl mt-1">What&apos;s new</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recent changes, newest first.
        </p>
      </div>

      <div className="space-y-4">
        {UPDATES.map((update) => (
          <Card key={update.date}>
            <CardHeader className="pb-2">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">{update.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {formatDate(update.date)}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                {update.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
