"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Destructive account actions — only "Delete Account" for now. Gated
 * behind a two-step confirm because it's irreversible: we wipe the
 * Prisma row (cascade), then the Supabase auth user.
 */
export function DangerZoneCard() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      if (!res.ok) {
        setLoading(false);
        alert("Delete failed. Please contact support.");
        return;
      }
      // Sign out client-side so the cookie is cleared.
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth/login");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!confirming ? (
          <>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and all data (packs, cards,
              review history, subscription). This cannot be undone.
            </p>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive border-destructive/50"
              onClick={() => setConfirming(true)}
            >
              Delete Account
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm">
              Type{" "}
              <span className="font-mono font-semibold text-destructive">
                DELETE
              </span>{" "}
              to confirm. This will erase every pack, card, and review
              permanently.
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  setTyped("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={typed !== "DELETE" || loading}
                onClick={handleDelete}
              >
                {loading ? "Deleting…" : "Permanently delete"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
