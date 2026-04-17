"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradeBanner } from "@/components/subscription/upgrade-banner";
import { estimateImageGenTime } from "@/lib/utils";

interface GeneratedCard {
  front: string;
  back: string;
  hint?: string;
  imageUrl?: string;
}

interface Deck {
  id: string;
  name: string;
  emoji: string | null;
}

interface GenerateClientProps {
  decks: Deck[];
  isPro: boolean;
}

export function GenerateClient({ decks, isPro }: GenerateClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDeckId = searchParams.get("deckId") || "";
  const [topic, setTopic] = useState("");
  const [material, setMaterial] = useState("");
  const [generateImages, setGenerateImages] = useState(false);
  const [targetDeckId, setTargetDeckId] = useState(preselectedDeckId);
  const [newDeckName, setNewDeckName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [expectedCount, setExpectedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [error, setError] = useState("");
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [imageTotalNeeded, setImageTotalNeeded] = useState(0);
  const [pendingImageIndices, setPendingImageIndices] = useState<Set<number>>(new Set());

  const abortRef = useRef(false);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [uploadTargetIndex, setUploadTargetIndex] = useState<number | null>(null);

  // Shared image generation helper
  const generateImagesForCards = useCallback(
    async (currentCards: GeneratedCard[]) => {
      const needingImages = currentCards
        .map((c, i) => ({ front: c.front, back: c.back, index: i }))
        .filter((_, i) => !currentCards[i].imageUrl);

      if (needingImages.length === 0) return;

      setGeneratingImages(true);
      setImageProgress(0);
      setImageTotalNeeded(needingImages.length);
      setPendingImageIndices(new Set(needingImages.map((c) => c.index)));
      abortRef.current = false;

      for (let i = 0; i < needingImages.length; i++) {
        if (abortRef.current) break;
        const card = needingImages[i];
        setPendingImageIndices((prev) => {
          const next = new Set(prev);
          next.add(card.index);
          return next;
        });
        try {
          const res = await fetch("/api/images/generate-ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ front: card.front, back: card.back }),
          });
          const data = await res.json();
          if (res.ok && data.imageUrl) {
            setCards((prev) =>
              prev.map((c, idx) =>
                idx === card.index ? { ...c, imageUrl: data.imageUrl } : c
              )
            );
          }
        } catch {
          // Skip failed images — user can regenerate individually
        }
        setPendingImageIndices((prev) => {
          const next = new Set(prev);
          next.delete(card.index);
          return next;
        });
        setImageProgress(i + 1);
      }

      setGeneratingImages(false);
      setPendingImageIndices(new Set());
    },
    []
  );

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError("");
    setCards([]);
    setGeneratedCount(0);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          material: material.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to generate cards");
        return;
      }

      const generated: GeneratedCard[] = data.cards;
      setExpectedCount(generated.length);

      // Animate cards appearing one by one
      for (let i = 0; i < generated.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        setGeneratedCount(i + 1);
      }

      setCards(generated);

      // Auto-trigger image generation if toggle is ON
      if (generateImages) {
        // Small delay so the edit UI renders first
        setTimeout(() => generateImagesForCards(generated), 100);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
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
      body: JSON.stringify(
        cards.map((c) => ({
          front: c.front,
          back: c.back,
          hint: c.hint || null,
          imageUrl: c.imageUrl || null,
        }))
      ),
    });

    if (res.ok) {
      // Stop any in-progress client-side generation
      abortRef.current = true;

      const hasPendingImages = generateImages && cards.some((c) => !c.imageUrl);

      if (hasPendingImages) {
        // Kick off server-side background generation for any cards
        // that didn't get images yet. User navigates immediately —
        // images will appear on the deck view as they complete.
        fetch("/api/images/generate-deck-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deckId }),
        }).catch(() => {
          // Silently ignore — user can retry from deck view
        });
        router.push(`/decks/${deckId}?generating=true`);
      } else {
        router.push(`/decks/${deckId}`);
      }
      router.refresh();
    }

    setSaving(false);
  }

  async function handleRegenerateImage(index: number) {
    const card = cards[index];
    setPendingImageIndices((prev) => new Set(prev).add(index));
    try {
      const res = await fetch("/api/images/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: card.front, back: card.back }),
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setCards((prev) =>
          prev.map((c, i) => (i === index ? { ...c, imageUrl: data.imageUrl } : c))
        );
      }
    } catch {
      // Silently fail — user can retry
    }
    setPendingImageIndices((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  function triggerUpload(index: number) {
    setUploadTargetIndex(index);
    imageUploadRef.current?.click();
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploadTargetIndex === null) return;

    const formData = new FormData();
    formData.append("file", file);

    setPendingImageIndices((prev) => new Set(prev).add(uploadTargetIndex));
    try {
      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const idx = uploadTargetIndex;
        setCards((prev) =>
          prev.map((c, i) => (i === idx ? { ...c, imageUrl: data.url } : c))
        );
      }
    } catch {
      // Silently fail
    }
    setPendingImageIndices((prev) => {
      const next = new Set(prev);
      next.delete(uploadTargetIndex);
      return next;
    });
    setUploadTargetIndex(null);
    // Reset file input
    if (imageUploadRef.current) imageUploadRef.current.value = "";
  }

  function updateCard(index: number, field: keyof GeneratedCard, value: string) {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function removeCard(index: number) {
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  function handleStartOver() {
    abortRef.current = true;
    setCards([]);
    setExpectedCount(0);
    setGeneratedCount(0);
    setImageProgress(0);
    setGeneratingImages(false);
    setPendingImageIndices(new Set());
  }

  const step = cards.length > 0 ? "edit" : generating ? "generating" : "input";

  if (!isPro) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Generate a Pack from Text</h1>
          <p className="text-muted-foreground mt-1">
            Paste lecture notes, a textbook chapter, or any text below. Our AI will automatically create a pack of flashcards from it.
          </p>
        </div>
        <UpgradeBanner feature="AI card generation" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generate a Pack from Text</h1>
        <p className="text-muted-foreground mt-1">
          Use AI to generate flashcard sets from a topic or study material
        </p>
      </div>

      {/* Hidden file input for per-card image upload */}
      <input
        ref={imageUploadRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImageUpload}
      />

      {step === "input" && (
        <form onSubmit={handleGenerate} className="space-y-4 max-w-lg">
          <Input
            id="topic"
            label="Topic"
            placeholder="e.g. Photosynthesis, Spanish greetings, World War II"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
          />

          <Textarea
            id="material"
            label="Study Material (optional)"
            placeholder="Paste text from your textbook, notes, or any study material. The AI will generate cards based on this content."
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            rows={6}
          />

          {/* AI Image Generation Toggle */}
          <label className="flex items-center justify-between p-4 rounded-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors">
            <div>
              <p className="font-medium text-sm">Generate AI Images</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically create illustrations for each card
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={generateImages}
              onClick={() => setGenerateImages(!generateImages)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                generateImages ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  generateImages ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={!topic.trim()} size="lg">
            Generate Flashcards
          </Button>
        </form>
      )}

      {step === "generating" && (
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <svg className="animate-spin h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold">
              {expectedCount > 0
                ? `${generatedCount} / ${expectedCount} cards generated`
                : "Generating cards..."}
            </p>
            <p className="text-sm text-muted-foreground">
              This may take a moment
            </p>
          </div>
          {expectedCount > 0 && (
            <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-150"
                style={{ width: `${(generatedCount / expectedCount) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {step === "edit" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {cards.length} cards generated
            </h2>
            <Button variant="outline" onClick={handleStartOver}>
              Start Over
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Review and edit your cards below, then save them to a pack.
          </p>

          {/* Image generation progress banner */}
          {generatingImages && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Generating images... {imageProgress} / {imageTotalNeeded}
                    </p>
                    <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{
                          width: `${(imageProgress / Math.max(imageTotalNeeded, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Please be patient — AI image generation is still in its infancy and takes a moment per card. Estimated time remaining:{" "}
                  <span className="font-medium text-foreground">
                    {estimateImageGenTime(Math.max(imageTotalNeeded - imageProgress, 0))}
                  </span>
                  . You can edit cards and save while images continue generating. Thank you for your patience.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Manual generate images button (when toggle was OFF) */}
          {!generatingImages && !generateImages && cards.some((c) => !c.imageUrl) && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">AI Images</p>
                    <p className="text-sm text-muted-foreground">
                      {cards.some((c) => c.imageUrl)
                        ? `${cards.filter((c) => c.imageUrl).length} of ${cards.length} cards have images`
                        : `Generate illustrations for all ${cards.filter((c) => !c.imageUrl).length} cards · ${estimateImageGenTime(cards.filter((c) => !c.imageUrl).length)}`}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => generateImagesForCards(cards)}>
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    Generate AI Images
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {cards.map((card, index) => (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground">
                      Card {index + 1} of {cards.length}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCard(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    label="Front"
                    value={card.front}
                    onChange={(e) => updateCard(index, "front", e.target.value)}
                    rows={2}
                  />
                  <Textarea
                    label="Back"
                    value={card.back}
                    onChange={(e) => updateCard(index, "back", e.target.value)}
                    rows={2}
                  />
                  <Input
                    label="Hint"
                    value={card.hint || ""}
                    onChange={(e) => updateCard(index, "hint", e.target.value)}
                    placeholder="Optional hint"
                  />

                  {/* Per-card image section */}
                  <div className="flex items-center gap-3 pt-1">
                    {pendingImageIndices.has(index) ? (
                      <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    ) : card.imageUrl ? (
                      <>
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
                            onClick={() => handleRegenerateImage(index)}
                          >
                            Regenerate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => triggerUpload(index)}
                          >
                            Upload
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground"
                            onClick={() =>
                              setCards((prev) =>
                                prev.map((c, i) =>
                                  i === index ? { ...c, imageUrl: undefined } : c
                                )
                              )
                            }
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
                          onClick={() => handleRegenerateImage(index)}
                        >
                          Generate Image
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => triggerUpload(index)}
                        >
                          Upload Image
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
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
                size="lg"
                onClick={handleSave}
                disabled={saving || cards.length === 0 || (!targetDeckId && !newDeckName.trim())}
              >
                {saving
                  ? "Saving..."
                  : generatingImages
                    ? `Save ${cards.length} Cards (images will continue in background)`
                    : `Save ${cards.length} Cards to Pack`}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
