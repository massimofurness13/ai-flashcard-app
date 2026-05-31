"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { unlockAudio } from "@/lib/tts";
import {
  CARDS_PER_SESSION_OPTIONS,
  AUTO_FLIP_MAX,
  RECOMMENDED_AUTO_TIMING,
  CARD_ORIENTATION_OPTIONS,
} from "@/lib/constants";

type StudyFilter = "due" | "random" | "created" | "mastery" | "recent" | "alpha";

const FILTER_OPTIONS: { value: StudyFilter; label: string; description: string }[] = [
  { value: "due", label: "Due for review", description: "Cards that are due based on spaced repetition (recommended)" },
  { value: "random", label: "Random", description: "A random sample from the selected packs" },
  { value: "mastery", label: "Needs practice", description: "Cards with the lowest mastery first" },
  { value: "created", label: "Created order", description: "Oldest cards first, in the order you added them" },
  { value: "recent", label: "Recently added", description: "Newest cards first" },
  { value: "alpha", label: "Alphabetical", description: "Sorted by the card's front text, A to Z" },
];

interface Deck {
  id: string;
  name: string;
  emoji: string | null;
  _count: { cards: number };
  lastReviewedAt?: string | null;
}

interface StudyConfigProps {
  decks: Deck[];
}

// Rough average seconds spent per card, including flipping + rating.
// Used only for the pre-session time estimate on the CTA — not exact.
const SECONDS_PER_CARD = 12;

// Shared localStorage key with the account-settings page. Each field
// is nullable — missing fields fall through to hardcoded defaults.
const SETTINGS_KEY = "huella-settings";

interface PersistedDefaults {
  defaultCards?: number;
  defaultAutoFlip?: number;
  defaultAutoAdvance?: number;
  defaultOrientation?: "front" | "back" | "mixed";
  /** Which packs the user last selected on this screen. We
   *  re-apply this on next visit so a returning user doesn't have
   *  to re-uncheck the same packs every session. Saved as an array
   *  of deck IDs; on hydration we filter out any IDs that no
   *  longer exist (deleted/archived) and never auto-add NEW packs
   *  the user has created since — those start unticked so the user
   *  consciously opts them into rotation. */
  defaultDeckIds?: string[];
  /** Last-used filter (due / random / recent / etc.). User picks
   *  a filter once and expects it to stick — the previous version
   *  was always resetting back to "due" on next visit. */
  defaultFilter?: StudyFilter;
  /** Last-used tag selection. Same rationale as deck IDs — we
   *  filter to tags that still exist on the user's cards so a
   *  rename/delete doesn't leave dead chips on the next visit. */
  defaultTags?: string[];
}

/**
 * Read the persisted study defaults. Safe to call during SSR — returns
 * an empty object server-side, full values client-side.
 */
function readDefaults(): PersistedDefaults {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedDefaults;
  } catch {
    return {};
  }
}

/** Merge a partial patch into the existing settings blob. */
function writeDefaults(patch: PersistedDefaults): void {
  if (typeof window === "undefined") return;
  try {
    const existing = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || "{}"
    ) as PersistedDefaults;
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...existing, ...patch })
    );
  } catch {
    /* ignore */
  }
}

type RecencyPreset = "7" | "30" | "all" | "none";

const RECENCY_PRESETS: { key: RecencyPreset; label: string }[] = [
  { key: "7", label: "Active 7d" },
  { key: "30", label: "Active 30d" },
  { key: "all", label: "All" },
  { key: "none", label: "None" },
];

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `~${totalSeconds}s`;
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `~${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (remMins === 0) return `~${hours}h`;
  return `~${hours}h ${remMins}m`;
}

export function StudyConfig({ decks }: StudyConfigProps) {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
      <StudyConfigInner decks={decks} />
    </Suspense>
  );
}

function StudyConfigInner({ decks }: StudyConfigProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill pack and filter from URL (e.g. from deck-view "Study" button)
  const preselectedDeckIds = searchParams.get("deckIds")?.split(",").filter(Boolean);
  const preselectedFilter = searchParams.get("filter") as StudyFilter | null;

  // Initial deck selection priority:
  //   1. URL `?deckIds=` param (deep-link from a deck page / home CTA)
  //   2. Saved selection from previous visit (PersistedDefaults)
  //   3. All decks (first-time user, no saved preference)
  //
  // The useState initializer runs once on mount AND must be SSR-safe
  // — it can't touch localStorage on the server. So we start with the
  // URL/all-decks fallback and rehydrate to the saved selection
  // inside the useEffect below. A brief tick where everything looks
  // selected is acceptable; checkbox state corrects on the next paint.
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>(
    preselectedDeckIds && preselectedDeckIds.length > 0
      ? preselectedDeckIds
      : decks.map((d) => d.id)
  );
  const [filter, setFilter] = useState<StudyFilter>(preselectedFilter || "due");
  // Start with hardcoded defaults to stay SSR-safe — the useEffect
  // below hydrates with localStorage values on the client. A brief
  // flash of defaults is acceptable since the session-settings card
  // sits below the fold on most screens.
  const [cardsPerSession, setCardsPerSession] = useState(25);
  const [customCards, setCustomCards] = useState("");
  const [isCustomCards, setIsCustomCards] = useState(false);
  const [autoFlip, setAutoFlip] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(0);
  const [orientation, setOrientation] = useState<"front" | "back" | "mixed">("front");

  // Hydrate session-settings from localStorage on mount. URL params
  // win over saved defaults for this visit (e.g. home page sends
  // `?limit=12` for "cards left in daily goal"), but don't overwrite
  // the saved defaults — the user would be surprised if a contextual
  // home-page nudge permanently changed their preference.
  useEffect(() => {
    const d = readDefaults();
    const urlLimit = searchParams.get("limit");

    if (urlLimit) {
      const parsed = parseInt(urlLimit, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        setCardsPerSession(parsed);
        if (
          !(CARDS_PER_SESSION_OPTIONS as readonly number[]).includes(parsed)
        ) {
          setCustomCards(String(parsed));
          setIsCustomCards(true);
        }
      }
    } else if (typeof d.defaultCards === "number") {
      setCardsPerSession(d.defaultCards);
      if (
        !(CARDS_PER_SESSION_OPTIONS as readonly number[]).includes(
          d.defaultCards
        )
      ) {
        setCustomCards(String(d.defaultCards));
        setIsCustomCards(true);
      }
    }

    if (typeof d.defaultAutoFlip === "number") setAutoFlip(d.defaultAutoFlip);
    if (typeof d.defaultAutoAdvance === "number")
      setAutoAdvance(d.defaultAutoAdvance);
    if (
      d.defaultOrientation === "front" ||
      d.defaultOrientation === "back" ||
      d.defaultOrientation === "mixed"
    ) {
      setOrientation(d.defaultOrientation);
    }
    // Deck selection rehydrate — only when the URL didn't already
    // pin a selection (deep-link context wins). We intersect with
    // the current `decks` list so deleted/archived packs disappear
    // gracefully instead of becoming ghost IDs the user can't see
    // or untick. If after that intersection the saved list is
    // empty (e.g. user deleted everything they had selected), fall
    // through to the default "all decks" and let them re-pick.
    if (
      !preselectedDeckIds?.length &&
      Array.isArray(d.defaultDeckIds) &&
      d.defaultDeckIds.length > 0
    ) {
      const liveIds = new Set(decks.map((deck) => deck.id));
      const filtered = d.defaultDeckIds.filter((id) => liveIds.has(id));
      if (filtered.length > 0) {
        setSelectedDeckIds(filtered);
      }
    }
    // Filter persistence — URL still wins so a deep-link from
    // "Today's session" can pin filter=due regardless of saved
    // preference. Otherwise honour what the user last picked.
    if (!preselectedFilter && d.defaultFilter) {
      setFilter(d.defaultFilter);
    }
    // Intentional: only run once on mount. searchParams listening here
    // would re-hydrate mid-edit and stomp the user's choices. Tag
    // hydration runs in its own useEffect (it depends on
    // availableTags being fetched first).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [availableTags, setAvailableTags] = useState<{ name: string; count: number }[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const param = searchParams.get("tags");
    return param ? param.split(",").filter(Boolean) : [];
  });

  useEffect(() => {
    fetch("/api/user/tags")
      .then((r) => r.json())
      .then((data: { tags: { name: string; count: number }[] }) => {
        const tags = data.tags || [];
        setAvailableTags(tags);
        // Tag hydration runs here (rather than in the main
        // hydration useEffect) because we need to know which tags
        // actually exist on the user's cards — otherwise a deleted/
        // renamed tag would survive in the saved list and silently
        // narrow the query to zero matches. URL still wins so a
        // deep-link can override.
        if (!searchParams.get("tags")) {
          const saved = readDefaults().defaultTags;
          if (Array.isArray(saved) && saved.length > 0) {
            const liveTagNames = new Set(tags.map((t) => t.name));
            const filtered = saved.filter((t) => liveTagNames.has(t));
            if (filtered.length > 0) setSelectedTags(filtered);
          }
        }
      })
      .catch(() => setAvailableTags([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag];
      writeDefaults({ defaultTags: next });
      return next;
    });
  }

  const totalCards = decks
    .filter((d) => selectedDeckIds.includes(d.id))
    .reduce((sum, d) => sum + d._count.cards, 0);

  // If URL said "autoStart", skip straight to session with the pre-selected params
  useEffect(() => {
    if (searchParams.get("autoStart") === "true" && preselectedDeckIds?.length) {
      const params = new URLSearchParams({
        deckIds: preselectedDeckIds.join(","),
        limit: "25",
        filter: preselectedFilter || "due",
        autoFlip: "0",
        autoAdvance: "0",
        orientation: "front",
      });
      router.replace(`/study/session?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the deck selection on every change so the user doesn't
  // have to re-uncheck the same packs every study session. Centralised
  // so toggleDeck + applyRecencyPreset both go through it.
  function updateSelectedDeckIds(next: string[]) {
    setSelectedDeckIds(next);
    writeDefaults({ defaultDeckIds: next });
  }

  function toggleDeck(deckId: string) {
    updateSelectedDeckIds(
      selectedDeckIds.includes(deckId)
        ? selectedDeckIds.filter((id) => id !== deckId)
        : [...selectedDeckIds, deckId],
    );
  }

  function applyRecencyPreset(preset: RecencyPreset) {
    if (preset === "all") {
      updateSelectedDeckIds(decks.map((d) => d.id));
      return;
    }
    if (preset === "none") {
      updateSelectedDeckIds([]);
      return;
    }
    const days = parseInt(preset, 10);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const active = decks
      .filter(
        (d) =>
          d.lastReviewedAt !== null &&
          d.lastReviewedAt !== undefined &&
          new Date(d.lastReviewedAt).getTime() >= cutoff
      )
      .map((d) => d.id);
    updateSelectedDeckIds(active);
  }

  function startStudy() {
    // Unlock audio NOW, inside this tap, so the session's get-ready
    // countdown doesn't outlive the browser's autoplay-gesture window
    // and leave every card silent. See unlockAudio() in lib/tts.
    unlockAudio();
    const params = new URLSearchParams({
      deckIds: selectedDeckIds.join(","),
      limit: String(cardsPerSession),
      filter,
      autoFlip: String(autoFlip),
      autoAdvance: String(autoAdvance),
      orientation,
    });
    if (selectedTags.length > 0) {
      params.set("tags", selectedTags.join(","));
    }
    router.push(`/study/session?${params.toString()}`);
  }

  const activeFilter = FILTER_OPTIONS.find((f) => f.value === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-editorial text-3xl font-medium sm:text-4xl">Study</h1>
        <p className="text-muted-foreground mt-1">
          Pick what you want to study. Every rating updates your progress.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle>Which packs?</CardTitle>
            {decks.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedDeckIds.length} / {decks.length} selected
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {decks.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">
                Quick select:
              </span>
              {RECENCY_PRESETS.map((preset) => (
                <Button
                  key={preset.key}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyRecencyPreset(preset.key)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {decks.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No packs created yet. Create a pack first!
              </p>
            ) : (
              decks.map((deck) => (
                <label
                  key={deck.id}
                  className="flex items-center gap-3 rounded-lg p-3 hover:bg-accent cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDeckIds.includes(deck.id)}
                    onChange={() => toggleDeck(deck.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-lg">{deck.emoji || "\ud83d\udcda"}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{deck.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {deck._count.cards} cards
                  </span>
                </label>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How should cards be picked?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={filter}
            onChange={(e) => {
              const next = e.target.value as StudyFilter;
              setFilter(next);
              writeDefaults({ defaultFilter: next });
            }}
            className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {activeFilter && (
            <p className="text-xs text-muted-foreground">{activeFilter.description}</p>
          )}
        </CardContent>
      </Card>

      {availableTags.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle>Filter by tag</CardTitle>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTags([]);
                    writeDefaults({ defaultTags: [] });
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => toggleTag(tag.name)}
                  className={`inline-flex items-center gap-1 rounded-md text-xs font-medium px-2 py-1 border transition-colors ${
                    selectedTags.includes(tag.name)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {tag.name}
                  <span className="opacity-70 font-normal">{tag.count}</span>
                </button>
              ))}
            </div>
            {selectedTags.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Only cards tagged with{" "}
                <strong>all</strong> of these will appear in this session.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Session settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Cards per session</label>
            <div className="flex gap-2 flex-wrap">
              {CARDS_PER_SESSION_OPTIONS.map((n) => (
                <Button
                  key={n}
                  variant={!isCustomCards && cardsPerSession === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setCardsPerSession(n);
                    setIsCustomCards(false);
                    setCustomCards("");
                    writeDefaults({ defaultCards: n });
                  }}
                >
                  {n}
                </Button>
              ))}
              <Input
                type="number"
                placeholder="Custom"
                value={customCards}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomCards(val);
                  const num = parseInt(val, 10);
                  if (num > 0) {
                    setCardsPerSession(num);
                    setIsCustomCards(true);
                    writeDefaults({ defaultCards: num });
                  }
                }}
                className="w-24 h-8 text-sm"
                min={1}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Auto-flip timer: {autoFlip === 0 ? "Off" : `${autoFlip.toFixed(1)}s`}
              </label>
              <button
                type="button"
                onClick={() => {
                  setAutoFlip(RECOMMENDED_AUTO_TIMING);
                  writeDefaults({ defaultAutoFlip: RECOMMENDED_AUTO_TIMING });
                }}
                className={`text-[11px] rounded-full px-2 py-0.5 transition-colors ${
                  autoFlip === RECOMMENDED_AUTO_TIMING
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                ★ Recommended: {RECOMMENDED_AUTO_TIMING}s
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Off</span>
              <input
                type="range"
                min={0}
                max={AUTO_FLIP_MAX}
                step={0.1}
                value={autoFlip}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setAutoFlip(v);
                  writeDefaults({ defaultAutoFlip: v });
                }}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">{AUTO_FLIP_MAX}s</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Auto-advance timer: {autoAdvance === 0 ? "Off" : `${autoAdvance.toFixed(1)}s`}
              </label>
              <button
                type="button"
                onClick={() => {
                  setAutoAdvance(RECOMMENDED_AUTO_TIMING);
                  writeDefaults({ defaultAutoAdvance: RECOMMENDED_AUTO_TIMING });
                }}
                className={`text-[11px] rounded-full px-2 py-0.5 transition-colors ${
                  autoAdvance === RECOMMENDED_AUTO_TIMING
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                ★ Recommended: {RECOMMENDED_AUTO_TIMING}s
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Off</span>
              <input
                type="range"
                min={0}
                max={AUTO_FLIP_MAX}
                step={0.1}
                value={autoAdvance}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setAutoAdvance(v);
                  writeDefaults({ defaultAutoAdvance: v });
                }}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">{AUTO_FLIP_MAX}s</span>
            </div>
            {autoAdvance > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Hands-free mode: cards move on automatically. Rating buttons are hidden.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Card orientation</label>
            <div className="flex gap-2">
              {CARD_ORIENTATION_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={orientation === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const v = opt.value as typeof orientation;
                    setOrientation(v);
                    writeDefaults({ defaultOrientation: v });
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full h-auto py-4"
        disabled={selectedDeckIds.length === 0 || totalCards === 0}
        onClick={startStudy}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span>Start Studying</span>
          {totalCards > 0 && selectedDeckIds.length > 0 && (
            <span className="text-xs opacity-80 font-normal">
              Estimated time:{" "}
              {formatDuration(
                Math.min(cardsPerSession, totalCards) * SECONDS_PER_CARD
              )}
            </span>
          )}
        </div>
      </Button>
    </div>
  );
}
