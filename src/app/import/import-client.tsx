"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnkiImport } from "@/components/import/anki-import";

interface ParsedCard {
  front: string;
  back: string;
  hint?: string;
  tags?: string;
}

interface Deck {
  id: string;
  name: string;
  emoji: string | null;
}

type ImportTab = "csv" | "anki";

export function ImportClient({ decks, isPro }: { decks: Deck[]; isPro: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<ImportTab>("csv");
  const [cards, setCards] = useState<ParsedCard[]>([]);
  const [targetDeckId, setTargetDeckId] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploading(true);
    setError("");
    setCards([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setCards(data.cards);
    } catch {
      setError("Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);

    let deckId = targetDeckId;

    if (!deckId && newDeckName.trim()) {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeckName.trim() }),
      });
      const deck = await res.json();
      deckId = deck.id;
    }

    if (!deckId) {
      setError("Please select a deck or enter a name for a new one");
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/decks/${deckId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cards),
    });

    if (res.ok) {
      router.push(`/decks/${deckId}`);
      router.refresh();
    }

    setSaving(false);
  }

  function removeCard(index: number) {
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Deck</h1>
        <p className="text-muted-foreground mt-1">
          Import flashcards from a file
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 border-b border-border pb-0">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "csv"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("csv")}
        >
          CSV / TSV / XML
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === "anki"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("anki")}
        >
          Anki (.apkg)
          {!isPro && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
              PRO
            </span>
          )}
        </button>
      </div>

      {tab === "anki" && <AnkiImport isPro={isPro} />}

      {tab === "csv" && cards.length === 0 ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <svg className="h-10 w-10 mx-auto text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              {uploading ? (
                <div className="space-y-2">
                  <svg className="animate-spin h-6 w-6 mx-auto text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-muted-foreground">Processing file... (AI will parse unusual formats automatically)</p>
                </div>
              ) : fileName ? (
                <p className="text-muted-foreground">{fileName}</p>
              ) : (
                <>
                  <p className="font-medium">Click to upload a file</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    CSV, TSV, or XML file with front/back fields
                  </p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt,.xml"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium">CSV / TSV format:</p>
              <p>Column 1: Front (question) | Column 2: Back (answer)</p>
              <p>Optional: Column 3: Hint | Column 4: Tags</p>
              <p>First row can be a header (auto-detected)</p>
              <p className="font-medium mt-3">XML format:</p>
              <p>{"<cards><card><front>...</front><back>...</back></card></cards>"}</p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      ) : tab === "csv" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">{cards.length} cards found in {fileName}</p>
            <Button variant="outline" onClick={() => { setCards([]); setFileName(""); }}>
              Choose Different File
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 border border-border rounded-lg p-3">
            {cards.map((card, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded hover:bg-accent">
                <span className="text-xs text-muted-foreground mt-1">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{card.front}</p>
                  <p className="text-sm text-muted-foreground truncate">{card.back}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeCard(i)}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Save to Pack</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={targetDeckId}
                onChange={(e) => {
                  setTargetDeckId(e.target.value);
                  if (e.target.value) setNewDeckName("");
                }}
              >
                <option value="">Create a new pack...</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.emoji} {d.name}
                  </option>
                ))}
              </select>

              {!targetDeckId && (
                <Input
                  placeholder="New pack name"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                />
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saving || cards.length === 0 || (!targetDeckId && !newDeckName.trim())}
              >
                {saving ? "Saving..." : `Import ${cards.length} Cards`}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
