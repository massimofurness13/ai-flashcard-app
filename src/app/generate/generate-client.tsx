"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradeBanner } from "@/components/subscription/upgrade-banner";
import { ImageTierSlider } from "@/components/generate/image-tier-slider";
import { estimateImageGenTime } from "@/lib/utils";
import { VOICE_CATALOG, getVoiceGroups } from "@/lib/voice-catalog";

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

interface AnkiResult {
  decksCreated: number;
  cardsImported: number;
  mediaUploaded: number;
  deckIds: string[];
  errors: string[];
}

const EMOJIS = [
  "📚",
  "🌟",
  "🧠",
  "🔬",
  "🌍",
  "🎨",
  "💻",
  "🎵",
  "⚖️",
  "💬",
  "🧬",
  "📈",
];

const VOICE_GROUPS = getVoiceGroups();

export function GenerateClient({ decks, isPro }: GenerateClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDeckId = searchParams.get("deckId") || "";

  // Pack metadata — gathered up-front so the user can see at a glance
  // what they're about to make. Front/back language pickers are
  // deliberately deferred to the review screen, where the user can see
  // an actual sample card and pick the right voice for each side.
  const [packName, setPackName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [showCustomEmoji, setShowCustomEmoji] = useState(false);
  const [customEmojiInput, setCustomEmojiInput] = useState("");

  const [material, setMaterial] = useState("");
  // Number of cards (positionally first) that should get the Premium
  // FLUX-dev tier when the user clicks "Generate images". 0 = all
  // Quick. Defaults to 0 so the user makes a deliberate budget choice
  // rather than getting an opinionated split they didn't ask for.
  const [premiumCount, setPremiumCount] = useState(0);
  const [targetDeckId, setTargetDeckId] = useState(preselectedDeckId);
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

  // Language pickers live on the review screen now, so they're set
  // alongside the cards rather than buried in a separate flow.
  const [frontLanguageCode, setFrontLanguageCode] = useState("");
  const [backLanguageCode, setBackLanguageCode] = useState("");

  // Anki .apkg detection — if the file picker receives one, we route
  // straight to /api/import/anki and skip the AI step entirely.
  const [ankiImporting, setAnkiImporting] = useState(false);
  const [ankiFileName, setAnkiFileName] = useState("");
  const [ankiResult, setAnkiResult] = useState<AnkiResult | null>(null);

  const abortRef = useRef(false);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetIndex, setUploadTargetIndex] = useState<number | null>(null);
  const [fileExtracting, setFileExtracting] = useState(false);

  /**
   * Single file picker that auto-detects what to do with the upload.
   * - .apkg / .colpkg → route directly to /api/import/anki, skip review
   * - .pdf → on-device pdfjs text extraction → append to material
   * - .txt / .md / .csv / .tsv / .json / .html / .xml → readAsText
   */
  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isAnki = /\.(apkg|colpkg)$/i.test(lowerName);
    const isPdf =
      file.type === "application/pdf" || lowerName.endsWith(".pdf");
    const isText =
      file.type.startsWith("text/") ||
      /\.(txt|md|markdown|csv|tsv|json|html?|xml)$/i.test(lowerName);

    setError("");

    // Anki: hand off entirely to the import endpoint. The AI flow is
    // skipped — Anki decks already have well-formed cards and SM-2
    // history we want to preserve.
    if (isAnki) {
      if (!isPro) {
        setError("Anki import is a Pro feature. Upgrade to import .apkg files.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setAnkiFileName(file.name);
      setAnkiImporting(true);
      setAnkiResult(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/import/anki", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Anki import failed");
          setAnkiImporting(false);
          return;
        }
        setAnkiResult(data as AnkiResult);
      } catch {
        setError("Network error during Anki import. Please try again.");
      } finally {
        setAnkiImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      return;
    }

    setFileExtracting(true);

    try {
      if (isPdf) {
        const { extractPdfText } = await import("@/lib/pdf-extract");
        const result = await extractPdfText(file);
        if (!result.text) {
          setError("No extractable text found in that PDF (it may be scanned images).");
          return;
        }
        setMaterial((prev) =>
          prev.trim() ? `${prev}\n\n${result.text}` : result.text
        );
        if (!packName.trim()) {
          setPackName(file.name.replace(/\.pdf$/i, ""));
        }
        if (result.truncated) {
          setError(
            `Only the first 50 pages were extracted (PDF had ${result.pages}+ pages).`
          );
        }
      } else if (isText) {
        const text = await file.text();
        if (!text.trim()) {
          setError("That file appears to be empty.");
          return;
        }
        setMaterial((prev) =>
          prev.trim() ? `${prev}\n\n${text}` : text
        );
        if (!packName.trim()) {
          setPackName(file.name.replace(/\.[^.]+$/, ""));
        }
      } else {
        setError(
          "Unsupported file type. Try Anki (.apkg), PDF, plain text, Markdown, CSV, JSON, HTML, or XML."
        );
      }
    } catch (err) {
      console.error("File extract failed:", err);
      setError("Couldn't read that file. Try pasting the text directly instead.");
    } finally {
      setFileExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /**
   * Generate images for `currentCards`, with the FIRST `premiumCount`
   * cards getting the Premium tier (FLUX dev, 5 credits) and the rest
   * getting Quick (FLUX schnell, 1 credit). `cap` truncates the work
   * to the first N cards positionally — used when the user is over
   * budget and chose "Generate what I can afford" rather than topping
   * up. Cards beyond the cap save without illustrations.
   */
  const generateImagesForCards = useCallback(
    async (
      currentCards: GeneratedCard[],
      premiumCount: number = 0,
      cap?: number
    ) => {
      const needingImages = currentCards
        .map((c, i) => ({ front: c.front, back: c.back, index: i }))
        .filter((_, i) => !currentCards[i].imageUrl);

      const slice =
        typeof cap === "number"
          ? needingImages.slice(0, Math.max(0, cap))
          : needingImages;

      if (slice.length === 0) return;

      setGeneratingImages(true);
      setImageProgress(0);
      setImageTotalNeeded(slice.length);
      setPendingImageIndices(new Set(slice.map((c) => c.index)));
      abortRef.current = false;

      for (let i = 0; i < slice.length; i++) {
        if (abortRef.current) break;
        const card = slice[i];
        const tier: "premium" | "quick" = i < premiumCount ? "premium" : "quick";
        setPendingImageIndices((prev) => {
          const next = new Set(prev);
          next.add(card.index);
          return next;
        });
        try {
          const res = await fetch("/api/images/generate-ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              front: card.front,
              back: card.back,
              tier,
            }),
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
          topic: packName.trim(),
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
      // No auto-trigger — image generation is now an explicit step on
      // the review screen via the silver/gold tier slider, after the
      // user can see how many cards they have and pick the mix.
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);

    let deckId = targetDeckId;

    // No deck pre-selected → create a new one with the metadata the
    // user picked at the top (name, emoji) and the language pickers
    // they set on the review screen.
    if (!deckId) {
      const trimmedName = packName.trim() || "Untitled Pack";
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          emoji,
          frontLanguageCode: frontLanguageCode || null,
          backLanguageCode: backLanguageCode || null,
        }),
      });
      if (!res.ok) {
        setError("Couldn't create the pack. Try again.");
        setSaving(false);
        return;
      }
      const deck = await res.json();
      deckId = deck.id;
    } else if (frontLanguageCode || backLanguageCode) {
      // User picked an existing deck — patch its language settings if
      // they've configured the review-screen pickers, so the voice
      // they chose actually sticks.
      await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontLanguageCode: frontLanguageCode || null,
          backLanguageCode: backLanguageCode || null,
        }),
      }).catch(() => {
        // Non-fatal — cards still save below
      });
    }

    if (!deckId) {
      setError("Couldn't determine which pack to save into.");
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
      router.push(`/decks/${deckId}`);
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

  // Sample card for the language picker — shows the user which side
  // is "front" and which is "back" before they assign voices to them.
  const sampleCard = cards[0]
    ? { front: cards[0].front, back: cards[0].back }
    : null;

  const step =
    ankiImporting || ankiResult
      ? "anki"
      : cards.length > 0
        ? "edit"
        : generating
          ? "generating"
          : "input";

  if (!isPro) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-editorial text-3xl font-medium sm:text-4xl">Create a Pack</h1>
          <p className="text-muted-foreground mt-1">
            Paste material, upload a file, or describe what you want to study —
            we&apos;ll do the rest.
          </p>
        </div>
        <UpgradeBanner feature="AI card generation" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-editorial text-3xl font-medium sm:text-4xl">Create a Pack</h1>
        <p className="text-muted-foreground mt-1">
          Paste material, upload a file, or describe what you want to study —
          we&apos;ll do the rest.
        </p>
      </div>

      {/* Hidden file input for per-card image upload (review screen) */}
      <input
        ref={imageUploadRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImageUpload}
      />

      {step === "input" && (
        <form onSubmit={handleGenerate} className="space-y-5 max-w-lg">
          {/* Emoji picker */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Emoji
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setEmoji(e);
                    setShowCustomEmoji(false);
                  }}
                  className={`text-2xl p-2 rounded-lg transition-colors ${
                    emoji === e
                      ? "bg-primary/20 ring-2 ring-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  {e}
                </button>
              ))}
              {emoji && !EMOJIS.includes(emoji) && (
                <button
                  type="button"
                  onClick={() => setShowCustomEmoji(true)}
                  className="text-2xl p-2 rounded-lg bg-primary/20 ring-2 ring-primary"
                  title="Your custom emoji"
                >
                  {emoji}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCustomEmoji(!showCustomEmoji)}
                className="text-xl p-2 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/10 transition-colors text-muted-foreground"
                aria-label="Add custom emoji"
              >
                +
              </button>
            </div>
            {showCustomEmoji && (
              <div className="mt-3 space-y-2">
                <Input
                  id="custom-emoji"
                  value={customEmojiInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomEmojiInput(val);
                    if (val.length > 0) {
                      const chars = Array.from(val);
                      const last = chars[chars.length - 1];
                      setEmoji(last);
                    }
                  }}
                  placeholder="Type or paste any emoji"
                  maxLength={10}
                  autoFocus
                />
              </div>
            )}
          </div>

          <Input
            id="pack-name"
            label="Pack name"
            placeholder="e.g. Spanish Vocabulary, Photosynthesis, World War II"
            value={packName}
            onChange={(e) => setPackName(e.target.value)}
            required
          />

          {/* Material — paste OR upload. The same picker also handles
           * Anki .apkg files, which short-circuit straight into the
           * importer instead of going through the AI step. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="material" className="text-sm font-medium">
                Study material (optional)
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileExtracting || ankiImporting}
              >
                {fileExtracting ? "Reading file…" : "Upload file"}
              </Button>
            </div>
            <Textarea
              id="material"
              label=""
              placeholder="Paste text, notes, or vocab — or upload a file (Anki .apkg, PDF, TXT, Markdown, CSV, JSON, HTML). Leave blank and we'll generate cards from the pack name alone."
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              rows={6}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".apkg,.colpkg,application/pdf,.pdf,text/plain,.txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.xml"
              onChange={handleFilePicked}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              Anki .apkg files are imported directly with their study history
              preserved. Everything else is fed to the AI to generate cards.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={!packName.trim()} size="lg">
            Generate flashcards
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

      {/* Anki importer — runs on the same page so the user never feels
       * like they took a wrong turn. On success we show a recap with a
       * link to the imported deck(s); on failure they can retry. */}
      {step === "anki" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {ankiImporting && (
              <div className="flex flex-col items-center py-8 space-y-4">
                <svg className="animate-spin h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <div className="text-center">
                  <p className="font-semibold">Importing {ankiFileName}...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Parsing cards, mapping study progress, and uploading media
                  </p>
                </div>
              </div>
            )}

            {ankiResult && (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4">
                  <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                    Import complete
                  </h3>
                  <ul className="text-sm space-y-1 text-green-700 dark:text-green-400">
                    <li>
                      {ankiResult.decksCreated} pack
                      {ankiResult.decksCreated !== 1 ? "s" : ""} created
                    </li>
                    <li>
                      {ankiResult.cardsImported} card
                      {ankiResult.cardsImported !== 1 ? "s" : ""} imported
                    </li>
                    {ankiResult.mediaUploaded > 0 && (
                      <li>
                        {ankiResult.mediaUploaded} media file
                        {ankiResult.mediaUploaded !== 1 ? "s" : ""} uploaded
                      </li>
                    )}
                  </ul>
                </div>

                {ankiResult.errors.length > 0 && (
                  <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-4">
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                      Warnings
                    </h3>
                    <ul className="text-sm space-y-1 text-yellow-700 dark:text-yellow-400">
                      {ankiResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2">
                  {ankiResult.deckIds.length === 1 ? (
                    <Button
                      onClick={() => {
                        router.push(`/decks/${ankiResult.deckIds[0]}`);
                        router.refresh();
                      }}
                    >
                      View imported pack
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        router.push("/");
                        router.refresh();
                      }}
                    >
                      View all packs
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAnkiResult(null);
                      setAnkiFileName("");
                    }}
                  >
                    Import another
                  </Button>
                </div>
              </div>
            )}

            {error && !ankiImporting && !ankiResult && (
              <div className="space-y-3">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError("");
                    setAnkiFileName("");
                  }}
                >
                  Try again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "edit" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl font-medium">
              {cards.length} cards generated
            </h2>
            <Button variant="outline" onClick={handleStartOver}>
              Start over
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Review and edit your cards below, then save them to a pack.
          </p>

          {/* Language pickers — moved here from the deck form so the
           * user can see actual front/back text from a real card and
           * pick the right voice for each side at a glance. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Text-to-speech language</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pick a language for each side. We&apos;ll use a curated
                native-speaker voice for that locale — Mexican Spanish in a
                Mexican accent, Castilian in a Madrid accent, and so on.
              </p>

              {sampleCard && (
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Example card from this pack
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Front
                      </p>
                      <p
                        className="mt-0.5 text-sm font-medium truncate"
                        title={sampleCard.front}
                      >
                        {sampleCard.front}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Back
                      </p>
                      <p
                        className="mt-0.5 text-sm font-medium truncate"
                        title={sampleCard.back}
                      >
                        {sampleCard.back}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Front language
                  </label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={frontLanguageCode}
                    onChange={(e) => setFrontLanguageCode(e.target.value)}
                  >
                    <option value="">Not set (use device voice)</option>
                    {VOICE_GROUPS.map((group) => (
                      <optgroup key={group} label={group}>
                        {VOICE_CATALOG.filter((v) => v.group === group).map((v) => (
                          <option key={v.code} value={v.code}>
                            {v.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Back language
                  </label>
                  <select
                    className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={backLanguageCode}
                    onChange={(e) => setBackLanguageCode(e.target.value)}
                  >
                    <option value="">Not set (use device voice)</option>
                    {VOICE_GROUPS.map((group) => (
                      <optgroup key={group} label={group}>
                        {VOICE_CATALOG.filter((v) => v.group === group).map((v) => (
                          <option key={v.code} value={v.code}>
                            {v.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

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

          {/* AI Images — silver/gold tier slider. */}
          {!generatingImages && cards.some((c) => !c.imageUrl) && (
            <ImageTierSlider
              total={cards.filter((c) => !c.imageUrl).length}
              premiumCount={Math.min(premiumCount, cards.filter((c) => !c.imageUrl).length)}
              onChange={setPremiumCount}
              onGenerate={(cap) =>
                generateImagesForCards(
                  cards,
                  Math.min(premiumCount, cards.filter((c) => !c.imageUrl).length),
                  cap
                )
              }
            />
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
              <CardTitle>Save</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Existing-pack picker — defaults to "Create as new pack"
               * which uses the name + emoji from the input step. */}
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={targetDeckId}
                onChange={(e) => setTargetDeckId(e.target.value)}
              >
                <option value="">
                  Create new pack: {emoji} {packName.trim() || "Untitled Pack"}
                </option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    Add to: {d.emoji} {d.name}
                  </option>
                ))}
              </select>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                className="w-full"
                size="lg"
                onClick={handleSave}
                disabled={saving || cards.length === 0}
              >
                {saving
                  ? "Saving..."
                  : generatingImages
                    ? `Save ${cards.length} cards (images will continue in background)`
                    : `Save ${cards.length} cards`}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
