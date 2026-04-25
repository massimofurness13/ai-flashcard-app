"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ImageTierSlider } from "@/components/generate/image-tier-slider";

interface CardData {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  imageUrl: string | null;
}

interface EditCardsClientProps {
  deckId: string;
  deckName: string;
  deckEmoji: string | null;
  initialCards: CardData[];
  isPro: boolean;
}

/**
 * Bulk-edit view for a pack's cards. Three things you can do here:
 *
 * 1. Edit card text/hints inline. We auto-save each card on blur via
 *    PATCH /api/cards/:id — the row briefly shows a "Saving…" / "Saved"
 *    indicator so the change isn't a silent black-hole.
 * 2. Regenerate or upload an individual card's image. Same per-card
 *    controls as the create flow's review screen.
 * 3. Fire off a bulk image generation for cards that don't have one
 *    yet, with the silver/gold tier slider. We hand off to the
 *    server-side background route and redirect to the deck view so
 *    the polling banner picks up where we left off.
 */
export function EditCardsClient({
  deckId,
  deckName,
  deckEmoji,
  initialCards,
  isPro,
}: EditCardsClientProps) {
  const router = useRouter();
  const [cards, setCards] = useState<CardData[]>(initialCards);
  const [premiumCount, setPremiumCount] = useState(0);
  const [savingMap, setSavingMap] = useState<Record<string, "saving" | "saved" | "error" | undefined>>({});
  const [pendingImages, setPendingImages] = useState<Set<string>>(new Set());
  const [bulkGenLoading, setBulkGenLoading] = useState(false);
  const [bulkGenError, setBulkGenError] = useState("");
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  // Snapshot of last-saved values so we can skip redundant PATCH calls
  // on blur. Without this, every blur triggers a network round-trip
  // even if the user didn't change anything.
  const lastSavedRef = useRef<Record<string, { front: string; back: string; hint: string | null }>>(
    Object.fromEntries(
      initialCards.map((c) => [c.id, { front: c.front, back: c.back, hint: c.hint }])
    )
  );

  function setSavingState(id: string, state: "saving" | "saved" | "error") {
    setSavingMap((prev) => ({ ...prev, [id]: state }));
    if (state === "saved") {
      // Auto-clear the "Saved" badge after 2s so it doesn't linger
      // indefinitely. "Error" sticks until the next save attempt.
      setTimeout(() => {
        setSavingMap((prev) => {
          if (prev[id] !== "saved") return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 2000);
    }
  }

  function updateLocal(id: string, field: "front" | "back" | "hint", value: string) {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: field === "hint" ? value : value } : c))
    );
  }

  async function persistCard(id: string) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;

    const last = lastSavedRef.current[id];
    if (
      last &&
      last.front === card.front &&
      last.back === card.back &&
      last.hint === (card.hint ?? null)
    ) {
      return; // No change — skip the round-trip
    }

    setSavingState(id, "saving");
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: card.front,
          back: card.back,
          hint: card.hint,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      lastSavedRef.current[id] = {
        front: card.front,
        back: card.back,
        hint: card.hint ?? null,
      };
      setSavingState(id, "saved");
    } catch {
      setSavingState(id, "error");
    }
  }

  async function removeCard(id: string) {
    if (!confirm("Remove this card permanently?")) return;
    try {
      const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCards((prev) => prev.filter((c) => c.id !== id));
        delete lastSavedRef.current[id];
      }
    } catch {
      // Silent — nothing changed locally
    }
  }

  async function regenerateImage(id: string) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    setPendingImages((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/images/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: card.front, back: card.back, tier: "quick" }),
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        // Persist the new imageUrl on the card row before reflecting
        // it locally — otherwise a refresh would lose it.
        await fetch(`/api/cards/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: data.imageUrl }),
        });
        setCards((prev) =>
          prev.map((c) => (c.id === id ? { ...c, imageUrl: data.imageUrl } : c))
        );
      }
    } catch {
      // Silent
    }
    setPendingImages((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function triggerUpload(id: string) {
    setUploadTargetId(id);
    imageUploadRef.current?.click();
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;

    const formData = new FormData();
    formData.append("file", file);
    const id = uploadTargetId;

    setPendingImages((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        await fetch(`/api/cards/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: data.url }),
        });
        setCards((prev) =>
          prev.map((c) => (c.id === id ? { ...c, imageUrl: data.url } : c))
        );
      }
    } catch {
      // Silent
    }
    setPendingImages((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setUploadTargetId(null);
    if (imageUploadRef.current) imageUploadRef.current.value = "";
  }

  async function clearImage(id: string) {
    await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: null }),
    });
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, imageUrl: null } : c))
    );
  }

  /** Triggered by the slider. Hands off to the server-side background
   *  route with the chosen premium count, then navigates to the deck
   *  view (?generating=true) so the polling banner picks up images
   *  as they roll in. */
  async function generateMissingImages() {
    setBulkGenLoading(true);
    setBulkGenError("");
    try {
      const res = await fetch("/api/images/generate-deck-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId,
          premiumCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkGenError(data.error || "Could not start image generation.");
        setBulkGenLoading(false);
        return;
      }
      router.push(`/decks/${deckId}?generating=true`);
      router.refresh();
    } catch {
      setBulkGenError("Network error. Please try again.");
      setBulkGenLoading(false);
    }
  }

  // Persist any in-flight edits when the user navigates away. Catches
  // the case where they click "Done" without first blurring an input.
  useEffect(() => {
    const flush = () => {
      Object.keys(lastSavedRef.current).forEach((id) => {
        const card = cards.find((c) => c.id === id);
        const last = lastSavedRef.current[id];
        if (
          card &&
          (card.front !== last.front ||
            card.back !== last.back ||
            (card.hint ?? null) !== last.hint)
        ) {
          // Best-effort sync — sendBeacon doesn't support PATCH, so we
          // just fire a regular fetch and rely on the browser to let
          // it complete during unload.
          fetch(`/api/cards/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              front: card.front,
              back: card.back,
              hint: card.hint,
            }),
            keepalive: true,
          }).catch(() => {});
        }
      });
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [cards]);

  const cardsWithoutImages = cards.filter((c) => !c.imageUrl).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/decks/${deckId}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to pack
          </Link>
          <h1 className="font-editorial text-3xl font-medium sm:text-4xl mt-1 flex items-center gap-2">
            <span>{deckEmoji || "📚"}</span>
            Edit cards
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {deckName} · {cards.length} card{cards.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href={`/decks/${deckId}`}>
          <Button>Done</Button>
        </Link>
      </div>

      {/* Hidden file input for per-card uploads */}
      <input
        ref={imageUploadRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Bulk image generation slider — only when there are cards
       * without images AND the user is Pro. */}
      {cardsWithoutImages > 0 && isPro && (
        <ImageTierSlider
          total={cardsWithoutImages}
          premiumCount={Math.min(premiumCount, cardsWithoutImages)}
          onChange={setPremiumCount}
          onGenerate={generateMissingImages}
        />
      )}

      {bulkGenLoading && (
        <p className="text-sm text-muted-foreground">Starting generation…</p>
      )}
      {bulkGenError && (
        <p className="text-sm text-destructive">{bulkGenError}</p>
      )}

      {/* Per-card editor list. Same shape as the review screen so users
       * who edit right after creating a pack feel at home. */}
      <div className="space-y-3">
        {cards.map((card, index) => {
          const status = savingMap[card.id];
          return (
            <Card key={card.id}>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Card {index + 1} of {cards.length}
                  </p>
                  <div className="flex items-center gap-2">
                    {status === "saving" && (
                      <span className="text-xs text-muted-foreground">Saving…</span>
                    )}
                    {status === "saved" && (
                      <span className="text-xs text-[color:var(--glow)]">Saved</span>
                    )}
                    {status === "error" && (
                      <span className="text-xs text-destructive">
                        Save failed — try again
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCard(card.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                <Textarea
                  label="Front"
                  value={card.front}
                  onChange={(e) => updateLocal(card.id, "front", e.target.value)}
                  onBlur={() => persistCard(card.id)}
                  rows={2}
                />
                <Textarea
                  label="Back"
                  value={card.back}
                  onChange={(e) => updateLocal(card.id, "back", e.target.value)}
                  onBlur={() => persistCard(card.id)}
                  rows={2}
                />
                <Input
                  label="Hint"
                  value={card.hint || ""}
                  onChange={(e) => updateLocal(card.id, "hint", e.target.value)}
                  onBlur={() => persistCard(card.id)}
                  placeholder="Optional hint"
                />

                {/* Per-card image controls — same as create flow */}
                <div className="flex items-center gap-3 pt-1">
                  {pendingImages.has(card.id) ? (
                    <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  ) : card.imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={card.imageUrl}
                        alt={`Image for card ${index + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border border-border"
                      />
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => regenerateImage(card.id)}
                        >
                          Regenerate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => triggerUpload(card.id)}
                        >
                          Upload
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground"
                          onClick={() => clearImage(card.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => regenerateImage(card.id)}
                      >
                        Generate Image
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => triggerUpload(card.id)}
                      >
                        Upload Image
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <Link href={`/decks/${deckId}`}>
          <Button>Done</Button>
        </Link>
      </div>
    </div>
  );
}
