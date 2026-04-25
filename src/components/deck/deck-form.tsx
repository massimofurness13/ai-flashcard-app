"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VOICE_CATALOG, getVoiceGroups } from "@/lib/voice-catalog";

interface Folder {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

interface DeckFormProps {
  mode: "create" | "edit";
  initialData?: {
    id?: string;
    name: string;
    description: string | null;
    emoji: string | null;
    folderId: string | null;
    frontVoice: string | null;
    backVoice: string | null;
    frontLanguageCode: string | null;
    backLanguageCode: string | null;
  };
  /** An example card from this pack, shown next to the language pickers
   *  so the user can see exactly which text is the front and which is the
   *  back before setting the voice for each side. */
  previewCard?: { front: string; back: string } | null;
}

const EMOJIS = ["\ud83d\udcda", "\ud83c\udf1f", "\ud83e\udde0", "\ud83d\udd2c", "\ud83c\udf0d", "\ud83c\udfa8", "\ud83d\udcbb", "\ud83c\udfb5", "\u2696\ufe0f", "\ud83d\udcac", "\ud83e\uddec", "\ud83d\udcc8"];

const VOICE_GROUPS = getVoiceGroups();

export function DeckForm({ mode, initialData, previewCard }: DeckFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [emoji, setEmoji] = useState(initialData?.emoji || "\ud83d\udcda");
  const [folderId, setFolderId] = useState(initialData?.folderId || "");
  const [frontLanguageCode, setFrontLanguageCode] = useState(
    initialData?.frontLanguageCode || ""
  );
  const [backLanguageCode, setBackLanguageCode] = useState(
    initialData?.backLanguageCode || ""
  );
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showCustomEmoji, setShowCustomEmoji] = useState(false);
  const [customEmojiInput, setCustomEmojiInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/folders")
      .then((res) => res.json())
      .then(setFolders);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    let targetFolderId = folderId;

    if (showNewFolder && newFolderName.trim()) {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      const folder = await res.json();
      targetFolderId = folder.id;
    }

    const url =
      mode === "edit" ? `/api/decks/${initialData?.id}` : "/api/decks";
    const method = mode === "edit" ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        emoji,
        folderId: targetFolderId || null,
        frontLanguageCode: frontLanguageCode || null,
        backLanguageCode: backLanguageCode || null,
      }),
    });

    if (res.ok) {
      const deck = await res.json();
      router.push(mode === "edit" ? `/decks/${deck.id}` : `/decks/${deck.id}`);
      router.refresh();
    }

    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
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
          {/* Show the currently-selected custom emoji (if it's not in the preset list) */}
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
          {/* + button to open custom emoji input */}
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
                // Use the last character typed, so only a single emoji lands
                if (val.length > 0) {
                  // Use Array.from to handle multi-code-point emojis correctly
                  const chars = Array.from(val);
                  const last = chars[chars.length - 1];
                  setEmoji(last);
                }
              }}
              placeholder="Type or paste any emoji"
              maxLength={10}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Mac: <kbd className="px-1 py-0.5 text-[10px] bg-muted rounded border border-border">Ctrl</kbd> <kbd className="px-1 py-0.5 text-[10px] bg-muted rounded border border-border">Cmd</kbd> <kbd className="px-1 py-0.5 text-[10px] bg-muted rounded border border-border">Space</kbd>
              {" · "}
              Windows: <kbd className="px-1 py-0.5 text-[10px] bg-muted rounded border border-border">Win</kbd> <kbd className="px-1 py-0.5 text-[10px] bg-muted rounded border border-border">.</kbd>
              {" · "}
              iOS: emoji keyboard
            </p>
          </div>
        )}
      </div>

      <Input
        id="name"
        label="Pack Name"
        placeholder="e.g. Spanish Vocabulary"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <Textarea
        id="description"
        label="Description (optional)"
        placeholder="What's this pack about?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />

      {/* Language settings — drives which native-speaker voice plays for each side */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Text-to-Speech language
          </label>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            Pick a language for each side. We&apos;ll use a curated
            native-speaker voice for that locale — Mexican Spanish in
            a Mexican accent, Castilian in a Madrid accent, and so on.
          </p>
        </div>

        {previewCard && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Example card from this pack
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted-foreground">
                  Front
                </p>
                <p className="mt-0.5 text-sm font-medium truncate" title={previewCard.front}>
                  {previewCard.front}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted-foreground">
                  Back
                </p>
                <p className="mt-0.5 text-sm font-medium truncate" title={previewCard.back}>
                  {previewCard.back}
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
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Folder</label>
        {!showNewFolder ? (
          <div className="space-y-2">
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.emoji} {f.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setShowNewFolder(true)}
            >
              + Create new folder
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <button
              type="button"
              className="text-sm text-muted-foreground hover:underline"
              onClick={() => {
                setShowNewFolder(false);
                setNewFolderName("");
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={!name.trim() || saving}>
          {saving
            ? "Saving..."
            : mode === "edit"
              ? "Save Changes"
              : "Create Pack"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
