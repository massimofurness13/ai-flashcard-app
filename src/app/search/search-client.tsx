"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DeckResult {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  _count: { cards: number };
}

interface CardResult {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  tags: string | null;
  deck: { id: string; name: string; emoji: string | null };
}

interface TagResult {
  name: string;
  count: number;
}

type Tab = "all" | "decks" | "cards" | "tags";

const DEBOUNCE_MS = 250;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * Highlight every case-insensitive occurrence of `query` in `text`.
 * Returns a React fragment so we don't need dangerouslySetInnerHTML.
 */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-primary/25 text-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState<Tab>("all");
  const [results, setResults] = useState<{
    decks: DeckResult[];
    cards: CardResult[];
    tags: TagResult[];
  }>({ decks: [], cards: [], tags: [] });
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounced(query, DEBOUNCE_MS);

  useEffect(() => {
    // Reflect the typed query in the URL for shareability + back-button sanity
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedQuery) params.set("q", debouncedQuery);
    else params.delete("q");
    router.replace(`/search?${params.toString()}`, { scroll: false });

    if (!debouncedQuery.trim()) {
      setResults({ decks: [], cards: [], tags: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then(setResults)
      .catch(() => setResults({ decks: [], cards: [], tags: [] }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const totalHits =
    results.decks.length + results.cards.length + results.tags.length;

  const tabs: { key: Tab; label: string; count: number }[] = useMemo(
    () => [
      { key: "all", label: "All", count: totalHits },
      { key: "decks", label: "Packs", count: results.decks.length },
      { key: "cards", label: "Cards", count: results.cards.length },
      { key: "tags", label: "Tags", count: results.tags.length },
    ],
    [results, totalHits]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Find any pack, card, or tag across everything you&apos;ve made.
        </p>
      </div>

      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          autoFocus
          className="flex h-12 w-full rounded-lg border border-border bg-background px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {debouncedQuery && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab(t.key)}
              className="h-8"
            >
              {t.label}
              <span className="ml-1.5 text-xs opacity-70">{t.count}</span>
            </Button>
          ))}
        </div>
      )}

      {!debouncedQuery ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <p className="text-3xl">🔍</p>
            <p className="text-sm text-muted-foreground">
              Type to search across your packs, cards, and tags.
            </p>
          </CardContent>
        </Card>
      ) : loading && totalHits === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Searching…
        </p>
      ) : totalHits === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <p className="text-3xl">🤷</p>
            <p className="text-sm text-muted-foreground">
              No matches for <strong>{debouncedQuery}</strong>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(tab === "all" || tab === "decks") && results.decks.length > 0 && (
            <section>
              {tab === "all" && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Packs
                </h2>
              )}
              <div className="grid gap-2">
                {results.decks.map((deck) => (
                  <Link key={deck.id} href={`/decks/${deck.id}`}>
                    <Card className="hover:border-primary/30 transition-colors">
                      <CardContent className="py-3 flex items-center gap-3">
                        <span className="text-xl">
                          {deck.emoji || "\ud83d\udcda"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            <Highlight
                              text={deck.name}
                              query={debouncedQuery}
                            />
                          </p>
                          {deck.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              <Highlight
                                text={deck.description}
                                query={debouncedQuery}
                              />
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {deck._count.cards} cards
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {(tab === "all" || tab === "tags") && results.tags.length > 0 && (
            <section>
              {tab === "all" && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Tags
                </h2>
              )}
              <div className="flex flex-wrap gap-2">
                {results.tags.map((tag) => (
                  <Link
                    key={tag.name}
                    href={`/study?tags=${encodeURIComponent(tag.name)}`}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary text-sm font-medium px-3 py-1.5 hover:bg-primary/20 transition-colors"
                  >
                    <Highlight text={tag.name} query={debouncedQuery} />
                    <span className="opacity-70 text-xs">{tag.count}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {(tab === "all" || tab === "cards") && results.cards.length > 0 && (
            <section>
              {tab === "all" && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Cards
                </h2>
              )}
              <div className="space-y-2">
                {results.cards.map((card) => (
                  <Link
                    key={card.id}
                    href={`/decks/${card.deck.id}/cards/${card.id}/edit`}
                  >
                    <Card className="hover:border-primary/30 transition-colors">
                      <CardContent className="py-3 space-y-1">
                        <p className="text-sm font-medium">
                          <Highlight
                            text={card.front}
                            query={debouncedQuery}
                          />
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <Highlight text={card.back} query={debouncedQuery} />
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                          <span>
                            {card.deck.emoji} {card.deck.name}
                          </span>
                          {card.tags &&
                            card.tags
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean)
                              .slice(0, 3)
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-primary/10 text-primary px-1.5 py-0.5"
                                >
                                  {tag}
                                </span>
                              ))}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
