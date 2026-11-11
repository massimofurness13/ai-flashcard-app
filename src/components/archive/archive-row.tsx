"use client";
import { invalidateDeviceQueries } from "@/hooks/use-device-query";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setPackArchived } from "@/lib/archive-pack";

interface ArchiveRowProps {
  id: string;
  name: string;
  emoji: string | null;
  cardCount: number;
  archivedAt: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ArchiveRow({
  id,
  name,
  emoji,
  cardCount,
  archivedAt,
}: ArchiveRowProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnarchive() {
    setLoading(true);
    setError(null);
    try {
      await setPackArchived(id, false);
      invalidateDeviceQueries();
      router.refresh();
    } catch {
      setError("Couldn't restore this pack. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        "Permanently delete this pack and all its cards? This cannot be undone."
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/decks/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      invalidateDeviceQueries();
      router.refresh();
    } catch {
      setError("Couldn't delete this pack. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">{emoji || "\ud83d\udcda"}</span>
          <div className="min-w-0">
            <p className="font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground">
              {cardCount} {cardCount === 1 ? "card" : "cards"}
              {archivedAt && (
                <>
                  <span className="mx-1.5">·</span>
                  archived {formatDate(archivedAt)}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleUnarchive} disabled={loading}>
            {loading ? "Working…" : "Restore pack"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={loading}
            className="text-destructive hover:text-destructive"
          >
            Delete
          </Button>
        </div>
        {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
