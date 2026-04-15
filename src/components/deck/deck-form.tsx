"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  };
}

const EMOJIS = ["\ud83d\udcda", "\ud83c\udf1f", "\ud83e\udde0", "\ud83d\udd2c", "\ud83c\udf0d", "\ud83c\udfa8", "\ud83d\udcbb", "\ud83c\udfb5", "\u2696\ufe0f", "\ud83d\udcac", "\ud83e\uddec", "\ud83d\udcc8"];

export function DeckForm({ mode, initialData }: DeckFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [emoji, setEmoji] = useState(initialData?.emoji || "\ud83d\udcda");
  const [folderId, setFolderId] = useState(initialData?.folderId || "");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
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
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={`text-2xl p-2 rounded-lg transition-colors ${
                emoji === e
                  ? "bg-primary/20 ring-2 ring-primary"
                  : "hover:bg-accent"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
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
