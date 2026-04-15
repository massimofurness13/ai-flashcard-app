"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AiImageGenerator } from "@/components/flashcard/ai-image-generator";

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
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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

    const url =
      mode === "edit"
        ? `/api/cards/${initialData?.id}`
        : `/api/decks/${deckId}/cards`;
    const method = mode === "edit" ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
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
      router.push(`/decks/${deckId}`);
      router.refresh();
    }

    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this card?")) return;
    await fetch(`/api/cards/${initialData?.id}`, { method: "DELETE" });
    router.push(`/decks/${deckId}`);
    router.refresh();
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

      <Input
        id="tags"
        label="Tags (optional, comma-separated)"
        placeholder="e.g. vocabulary, chapter-1"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />

      {/* Image Upload + AI Generation */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Card Image (optional)
        </label>
        {imageUrl ? (
          <div className="relative inline-block">
            <img
              src={imageUrl}
              alt="Card image"
              className="w-40 h-40 object-cover rounded-lg border border-border"
            />
            <button
              type="button"
              onClick={() => setImageUrl("")}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:opacity-80"
            >
              X
            </button>
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
                onImageGenerated={(url) => setImageUrl(url)}
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

      <div className="flex gap-3">
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
