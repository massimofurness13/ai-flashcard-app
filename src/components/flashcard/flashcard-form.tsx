"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AiImageGenerator } from "@/components/flashcard/ai-image-generator";
import { ImageFeedbackButton } from "@/components/flashcard/image-feedback-button";
import { TagChipInput } from "@/components/flashcard/tag-chip-input";

interface FlashcardFormProps {
  deckId: string;
  mode: "create" | "edit";
  isPro?: boolean;
  initialData?: {
    id: string;
    front: string;
    back: string;
    hint: string | null;
    tags: string | null;
    imageUrl?: string | null;
    imageTier?: string | null;
  };
}

export function FlashcardForm({ deckId, mode, isPro, initialData }: FlashcardFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [front, setFront] = useState(initialData?.front || "");
  const [back, setBack] = useState(initialData?.back || "");
  const [hint, setHint] = useState(initialData?.hint || "");
  const [tags, setTags] = useState(initialData?.tags || "");
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || "");
  // Tracks which AI tier produced the current image. Persisted on
  // save so the feedback-for-regen flow can regenerate at the same
  // quality. Null when the image came from upload, not AI.
  const [imageTier, setImageTier] = useState<string | null>(
    initialData?.imageTier ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Visible save outcome — replaces the silent failure mode where a
  // non-OK API response would just turn the spinner off and leave the
  // user wondering whether anything happened.
  const [saveError, setSaveError] = useState("");
  const [savedConfirm, setSavedConfirm] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
        // Uploaded images aren't AI-tier'd; clear so the feedback
        // flow doesn't try to "regenerate" something the user uploaded.
        setImageTier(null);
      } else {
        alert(data.error || "Upload failed");
      }
    } catch {
      alert("Upload failed");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setSavedConfirm(false);

    const url =
      mode === "edit"
        ? `/api/cards/${initialData?.id}`
        : `/api/decks/${deckId}/cards`;
    const method = mode === "edit" ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: front.trim(),
          back: back.trim(),
          hint: hint.trim() || null,
          tags: tags.trim() || null,
          imageUrl: imageUrl || null,
          imageTier: imageUrl ? imageTier : null,
        }),
      });

      if (!res.ok) {
        let msg = "Save failed. Please try again.";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {
          // body wasn't JSON — fall through to generic message
        }
        setSaveError(msg);
        setSaving(false);
        return;
      }

      // Order matters: refresh the server cache for the deck view
      // FIRST so when we land there it shows the just-saved card,
      // then push the navigation. router.refresh is a no-op on the
      // current page; the actual reload happens on the destination.
      setSavedConfirm(true);
      router.refresh();
      router.push(`/decks/${deckId}`);
    } catch {
      setSaveError("Network error. Please try again.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this card?")) return;
    await fetch(`/api/cards/${initialData?.id}`, { method: "DELETE" });
    router.refresh();
    router.push(`/decks/${deckId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <Textarea
        id="front"
        label="Front (Question)"
        placeholder="What is the question?"
        value={front}
        onChange={(e) => setFront(e.target.value)}
        required
        rows={3}
      />

      <Textarea
        id="back"
        label="Back (Answer)"
        placeholder="What is the answer?"
        value={back}
        onChange={(e) => setBack(e.target.value)}
        required
        rows={3}
      />

      <Input
        id="hint"
        label="Hint (optional)"
        placeholder="A small hint to help recall"
        value={hint}
        onChange={(e) => setHint(e.target.value)}
      />

      <TagChipInput value={tags} onChange={setTags} />

      {/* Card image. Three states:
       *   - imageUrl set → preview + remove + Quick/Premium regen
       *   - imageUrl empty + uploading → spinner inside upload tile
       *   - imageUrl empty → upload tile + Quick/Premium generate
       *
       * Crucially the regen buttons are now visible in BOTH the
       * has-image and empty states. Previously they were only shown
       * when the card had no image, so a user with a generated image
       * had no way to ask for a different one without first removing
       * what they had. */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Card Image (optional)
        </label>

        {imageUrl ? (
          <div className="space-y-3">
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Card image"
                className="w-40 h-40 object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={() => {
                  setImageUrl("");
                  setImageTier(null);
                }}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:opacity-80"
                aria-label="Remove image"
              >
                X
              </button>
              {/* Feedback button only when (a) the card has a saved
               *  ID and (b) the current image came from AI. Uploads
               *  have no tier and no concept to "regenerate" against. */}
              {mode === "edit" && initialData?.id && imageTier && (
                <ImageFeedbackButton
                  cardId={initialData.id}
                  onImageRegenerated={(url, tier) => {
                    setImageUrl(url);
                    setImageTier(tier);
                  }}
                />
              )}
            </div>
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Replace with AI
              </p>
              {/* AiImageGenerator already handles its own quota dialog
               * + tier picker; just feed it the current text + a
               * callback that swaps the imageUrl in place. */}
              <AiImageGenerator
                front={front}
                back={back}
                currentImageUrl={imageUrl}
                onImageGenerated={(url, tier) => {
                  setImageUrl(url);
                  setImageTier(tier);
                }}
                isPro={isPro}
              />
            </div>
          </div>
        ) : (
          <div className="flex gap-3 items-start">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-40 h-40 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
            >
              {uploading ? (
                <span className="text-sm text-muted-foreground">Uploading...</span>
              ) : (
                <>
                  <svg className="h-8 w-8 text-muted-foreground mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                  <span className="text-xs text-muted-foreground">Click to upload</span>
                  <span className="text-xs text-muted-foreground">Max 5MB</span>
                </>
              )}
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <span className="text-xs text-muted-foreground">or</span>
              <AiImageGenerator
                front={front}
                back={back}
                onImageGenerated={(url, tier) => {
                  setImageUrl(url);
                  setImageTier(tier);
                }}
                isPro={isPro}
              />
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {saveError && (
        <p className="text-sm text-destructive">{saveError}</p>
      )}
      {savedConfirm && !saveError && (
        <p className="text-sm text-[color:var(--glow)]">
          Saved — taking you back to the pack…
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!front.trim() || !back.trim() || saving}>
          {saving
            ? "Saving..."
            : mode === "edit"
              ? "Save Changes"
              : "Add Card"}
        </Button>
        {mode === "create" && (
          <Button
            type="button"
            variant="secondary"
            disabled={!front.trim() || !back.trim() || saving}
            onClick={async () => {
              setSaving(true);
              setSaveError("");
              try {
                const res = await fetch(`/api/decks/${deckId}/cards`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    front: front.trim(),
                    back: back.trim(),
                    hint: hint.trim() || null,
                    tags: tags.trim() || null,
                    imageUrl: imageUrl || null,
                  }),
                });
                if (res.ok) {
                  setFront("");
                  setBack("");
                  setHint("");
                  setTags("");
                  setImageUrl("");
                } else {
                  setSaveError("Save failed. Please try again.");
                }
              } catch {
                setSaveError("Network error. Please try again.");
              }
              setSaving(false);
            }}
          >
            Add & Create Another
          </Button>
        )}
        {mode === "edit" && (
          <Button type="button" variant="destructive" onClick={handleDelete}>
            Delete Card
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
