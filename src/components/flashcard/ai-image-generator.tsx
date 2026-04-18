"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuotaExceededDialog } from "@/components/subscription/quota-exceeded-dialog";
import type { QuotaState } from "@/lib/image-quota";

interface AiImageGeneratorProps {
  front: string;
  back: string;
  currentImageUrl?: string;
  onImageGenerated: (url: string) => void;
  /** Kept for backward compat — no longer gates generation */
  isPro?: boolean;
}

export function AiImageGenerator({
  front,
  back,
  currentImageUrl,
  onImageGenerated,
}: AiImageGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [quotaState, setQuotaState] = useState<QuotaState | null>(null);

  async function handleGenerate() {
    if (!front.trim()) {
      setError("Add card text first to generate a relevant image");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/images/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: front.trim(), back: back.trim() }),
      });

      const data = await res.json();

      if (res.status === 402 && data.error === "out_of_quota") {
        setQuotaState(data.quota);
        setQuotaDialogOpen(true);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      if (data.imageUrl) {
        onImageGenerated(data.imageUrl);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        disabled={generating || !front.trim()}
      >
        {generating ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
            {currentImageUrl ? "Generate replacement image" : "Generate AI image"}
          </span>
        )}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <QuotaExceededDialog
        open={quotaDialogOpen}
        quota={quotaState}
        onClose={() => setQuotaDialogOpen(false)}
      />
    </div>
  );
}
