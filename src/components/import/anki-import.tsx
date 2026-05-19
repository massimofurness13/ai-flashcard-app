"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ImportResult {
  decksCreated: number;
  cardsImported: number;
  mediaUploaded: number;
  deckIds: string[];
  errors: string[];
}

interface AnkiImportProps {
  isPro: boolean;
}

export function AnkiImport({ isPro }: AnkiImportProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImporting(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import/anki", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }

      setResult(data as ImportResult);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Anki import is free for all authenticated users — "no lock-in"
  // is a load-bearing promise. The previous paywall has been
  // removed; the `isPro` prop is still threaded through callers but
  // unused here.

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Import from Anki
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && !importing && (
          <>
            <p className="text-sm text-muted-foreground">
              Upload your Anki .apkg file to import decks, cards, study progress, and media.
              Your SM-2 review schedule will be preserved.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
            >
              <svg className="h-10 w-10 mx-auto text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="font-medium">Click to upload .apkg file</p>
              <p className="text-sm text-muted-foreground mt-1">
                Max 100MB. Supports .apkg and .colpkg
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".apkg,.colpkg"
              onChange={handleImport}
              className="hidden"
            />
          </>
        )}

        {importing && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <svg className="animate-spin h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div className="text-center">
              <p className="font-semibold">Importing {fileName}...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Parsing cards, mapping study progress, and uploading media
              </p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4">
              <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                Import Complete!
              </h3>
              <ul className="text-sm space-y-1 text-green-700 dark:text-green-400">
                <li>{result.decksCreated} deck{result.decksCreated !== 1 ? "s" : ""} created</li>
                <li>{result.cardsImported} card{result.cardsImported !== 1 ? "s" : ""} imported</li>
                {result.mediaUploaded > 0 && (
                  <li>{result.mediaUploaded} media file{result.mediaUploaded !== 1 ? "s" : ""} uploaded</li>
                )}
              </ul>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-4">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                  Warnings
                </h3>
                <ul className="text-sm space-y-1 text-yellow-700 dark:text-yellow-400">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              {result.deckIds.length === 1 ? (
                <Button onClick={() => {
                  router.push(`/decks/${result.deckIds[0]}`);
                  router.refresh();
                }}>
                  View Imported Deck
                </Button>
              ) : (
                <Button onClick={() => {
                  router.push("/");
                  router.refresh();
                }}>
                  View All Decks
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setFileName("");
                }}
              >
                Import Another
              </Button>
            </div>
          </div>
        )}

        {error && !importing && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              onClick={() => {
                setError("");
                setFileName("");
              }}
            >
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
