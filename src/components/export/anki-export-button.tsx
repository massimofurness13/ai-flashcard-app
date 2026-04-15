"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface AnkiExportButtonProps {
  deckId: string;
  deckName: string;
  isPro: boolean;
  cardCount: number;
}

export function AnkiExportButton({
  deckId,
  deckName,
  isPro,
  cardCount,
}: AnkiExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!isPro) {
      alert("Anki export requires a Pro subscription");
      return;
    }

    if (cardCount === 0) {
      alert("This deck has no cards to export");
      return;
    }

    setExporting(true);

    try {
      const res = await fetch(`/api/export/anki?deckId=${deckId}`);

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Export failed");
        return;
      }

      // Download the file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = deckName.replace(/[^a-zA-Z0-9-_ ]/g, "_");
      a.download = `${safeName}.apkg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting || cardCount === 0}
      className="flex items-center gap-1.5"
    >
      {exporting ? (
        <>
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Exporting...
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export as Anki
          {!isPro && (
            <span className="text-[10px] bg-primary/10 text-primary px-1 py-0.5 rounded-full font-semibold">
              PRO
            </span>
          )}
        </>
      )}
    </Button>
  );
}
