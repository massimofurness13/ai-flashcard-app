"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradeBanner } from "@/components/subscription/upgrade-banner";

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
  const [topic, setTopic] = useState("");
  const [material, setMaterial] = useState("");
  const [targetDeckId, setTargetDeckId] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [expectedCount, setExpectedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [error, setError] = useState("");
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);

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
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);

    let deckId = targetDeckId;

    // Create new deck if needed
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

    // Save all cards to the deck
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
      router.push(`/decks/${deckId}`);
      router.refresh();
    }

    setSaving(false);
  }

  async function handleGenerateImages() {
    setGeneratingImages(true);
    setImageProgress(0);
    setError("");

    const cardsNeedingImages = cards
      .map((c, i) => ({ front: c.front, back: c.back, index: i }))
      .filter((c) => !cards[c.index].imageUrl);

    try {
      // Generate images one at a time for progress feedback
      for (let i = 0; i < cardsNeedingImages.length; i++) {
        const card = cardsNeedingImages[i];
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
          // Skip failed images silently — user can regenerate individually
        }
        setImageProgress(i + 1);
      }
    } catch {
      setError("Image generation encountered an error.");
    } finally {
      setGeneratingImages(false);
    }
  }

  function updateCard(index: number, field: keyof GeneratedCard, value: string) {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  }

  function removeCard(index: number) {
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  // Step 1: Input form
  // Step 2: Generating progress
  // Step 3: Edit cards + save
  const step = cards.length > 0 ? "edit" : generating ? "generating" : "input";

  if (!isPro) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Generate Flashcards</h1>
          <p className="text-muted-foreground mt-1">
            Use AI to generate flashcard sets from a topic or study material
          </p>
        </div>
        <UpgradeBanner feature="AI card generation" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generate Flashcards</h1>
        <p className="text-muted-foreground mt-1">
          Use AI to generate flashcard sets from a topic or study material
        </p>
      </div>

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
              {cards.length} / {cards.length} cards generated
            </h2>
            <Button
              variant="outline"
              onClick={() => { setCards([]); setExpectedCount(0); setGeneratedCount(0); setImageProgress(0); }}
            >
              Start Over
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Review and edit your cards below, then save them to a pack.
          </p>

          {/* AI Image Generation for all cards */}
          {isPro && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">AI Images</p>
                    <p className="text-sm text-muted-foreground">
                      {generatingImages
                        ? `Generating ${imageProgress} / ${cards.filter((c) => !c.imageUrl).length + imageProgress} images...`
                        : cards.some((c) => c.imageUrl)
                          ? `${cards.filter((c) => c.imageUrl).length} of ${cards.length} cards have images`
                          : "Generate illustrations for all cards"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleGenerateImages}
                    disabled={generatingImages}
                  >
                    {generatingImages ? (
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
                        Generate AI Images
                      </span>
                    )}
                  </Button>
                </div>
                {generatingImages && (
                  <div className="mt-3 w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{
                        width: `${(imageProgress / Math.max(cards.filter((c) => !c.imageUrl).length, 1)) * 100}%`,
                      }}
                    />
                  </div>
                )}
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
                  {card.imageUrl && (
                    <div className="flex items-center gap-3">
                      <img
                        src={card.imageUrl}
                        alt={`Image for card ${index + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border border-border"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setCards((prev) =>
                            prev.map((c, i) =>
                              i === index ? { ...c, imageUrl: undefined } : c
                            )
                          )
                        }
                        className="text-muted-foreground text-xs"
                      >
                        Remove image
                      </Button>
                    </div>
                  )}
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
                {saving ? "Saving..." : `Save ${cards.length} Cards to Pack`}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
