"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuotaExceededDialog } from "@/components/subscription/quota-exceeded-dialog";
import type { QuotaState } from "@/lib/image-quota";

type Tier = "quick" | "premium";

interface AiImageGeneratorProps {
  front: string;
  back: string;
  currentImageUrl?: string;
  onImageGenerated: (url: string) => void;
  /** Legacy prop — no longer used for gating */
  isPro?: boolean;
}

export function AiImageGenerator({
  front,
  back,
  currentImageUrl,
  onImageGenerated,
}: AiImageGeneratorProps) {
  const [generatingTier, setGeneratingTier] = useState<Tier | null>(null);
  const [error, setError] = useState("");
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [quotaState, setQuotaState] = useState<QuotaState | null>(null);

  async function handleGenerate(tier: Tier) {
    if (!front.trim()) {
      setError("Add card text first to generate a relevant image");
      return;
    }

    setGeneratingTier(tier);
    setError("");

    try {
      const res = await fetch("/api/images/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: front.trim(), back: back.trim(), tier }),
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
      setGeneratingTier(null);
    }
  }

  const label = currentImageUrl ? "Replace image" : "Generate image";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleGenerate("quick")}
          disabled={generatingTier !== null || !front.trim()}
        >
          {generatingTier === "quick" ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Generating Quick…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>✨</span>
              <span>Quick · 1 credit</span>
            </span>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleGenerate("premium")}
          disabled={generatingTier !== null || !front.trim()}
        >
          {generatingTier === "premium" ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Generating Premium…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span>🎨</span>
              <span>Premium · 5 credits</span>
            </span>
          )}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {label}: Quick ✨ is fast and clean. Premium 🎨 uses a richer illustrated style.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <QuotaExceededDialog
        open={quotaDialogOpen}
        quota={quotaState}
        onClose={() => setQuotaDialogOpen(false)}
      />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
