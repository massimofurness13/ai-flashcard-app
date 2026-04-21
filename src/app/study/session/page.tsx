"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { StudySession, type StudyStats } from "@/components/study/study-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StudyCard {
  id: string;
  front: string;
  back: string;
  imageUrl: string | null;
  hint: string | null;
  deck: { id: string; name: string; emoji: string | null };
}

function StudySessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [stats, setStats] = useState<StudyStats | null>(null);

  const deckIds = searchParams.get("deckIds") || "";
  const limit = searchParams.get("limit") || "25";
  const filter = searchParams.get("filter") || "due";
  const tags = searchParams.get("tags") || "";
  const autoFlip = parseFloat(searchParams.get("autoFlip") || "0");
  const autoAdvance = parseFloat(searchParams.get("autoAdvance") || "0");
  const orientation = (searchParams.get("orientation") || "front") as
    | "front"
    | "back"
    | "mixed";

  useEffect(() => {
    const params = new URLSearchParams();
    if (deckIds) params.set("deckIds", deckIds);
    params.set("limit", limit);
    params.set("filter", filter);
    if (tags) params.set("tags", tags);

    fetch(`/api/review?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setCards(data.cards);
        setLoading(false);
      });
  }, [deckIds, limit, filter, tags]);

  function handleComplete(sessionStats: StudyStats) {
    setStats(sessionStats);
    setCompleted(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading cards...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-5xl mb-4">{"\u2705"}</span>
        <h2 className="text-2xl font-bold">Nothing to study here</h2>
        <p className="text-muted-foreground mt-2">
          {filter === "due"
            ? "No cards are due right now. Try another filter."
            : "No cards matched the selected packs and filter."}
        </p>
        <div className="flex gap-3 mt-6">
          <Button onClick={() => router.push("/study")}>Change filter</Button>
          <Button variant="outline" onClick={() => router.push("/")}>
            Home
          </Button>
        </div>
      </div>
    );
  }

  if (completed && stats) {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="text-center py-8">
          <span className="text-5xl mb-4 block">{"\ud83c\udf1f"}</span>
          <h2 className="text-2xl font-bold">Session complete</h2>
          <p className="text-muted-foreground mt-2">
            You studied {stats.cardsReviewed} cards
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Session summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-red-500">Again</span>
              <span className="font-medium">{stats.ratings[1] || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-500">Good</span>
              <span className="font-medium">{stats.ratings[3] || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-500">Easy</span>
              <span className="font-medium">{stats.ratings[5] || 0}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => router.push("/study")}>
            Study more
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => router.push("/")}>
            Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <StudySession
      initialCards={cards}
      autoFlipSeconds={autoFlip}
      autoAdvanceSeconds={autoAdvance}
      orientation={orientation}
      onComplete={handleComplete}
    />
  );
}

export default function StudySessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <StudySessionContent />
    </Suspense>
  );
}
