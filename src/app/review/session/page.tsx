"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { ReviewSession, type ReviewStats } from "@/components/review/review-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReviewCard {
  id: string;
  front: string;
  back: string;
  imageUrl: string | null;
  hint: string | null;
  deck: { id: string; name: string; emoji: string | null };
}

function ReviewSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [stats, setStats] = useState<ReviewStats | null>(null);

  const deckIds = searchParams.get("deckIds") || "";
  const limit = searchParams.get("limit") || "10";
  const autoFlip = parseInt(searchParams.get("autoFlip") || "0", 10);
  const orientation = (searchParams.get("orientation") || "front") as "front" | "back" | "mixed";
  const recencyCutoff = searchParams.get("recencyCutoff") || "0";

  useEffect(() => {
    const params = new URLSearchParams();
    if (deckIds) params.set("deckIds", deckIds);
    params.set("limit", limit);
    if (recencyCutoff !== "0") params.set("recencyCutoff", recencyCutoff);

    fetch(`/api/review?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setCards(data.cards);
        setLoading(false);
      });
  }, [deckIds, limit, recencyCutoff]);

  function handleComplete(reviewStats: ReviewStats) {
    setStats(reviewStats);
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
        <h2 className="text-2xl font-bold">All caught up!</h2>
        <p className="text-muted-foreground mt-2">No cards due for review right now.</p>
        <Button className="mt-6" onClick={() => router.push("/")}>
          Back to Home
        </Button>
      </div>
    );
  }

  if (completed && stats) {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="text-center py-8">
          <span className="text-5xl mb-4 block">{"\ud83c\udf1f"}</span>
          <h2 className="text-2xl font-bold">Review Complete!</h2>
          <p className="text-muted-foreground mt-2">
            You reviewed {stats.cardsReviewed} cards
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Session Summary</CardTitle>
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
          <Button className="flex-1" onClick={() => router.push("/review")}>
            Review More
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => router.push("/")}>
            Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ReviewSession
      initialCards={cards}
      autoFlipSeconds={autoFlip}
      orientation={orientation}
      onComplete={handleComplete}
    />
  );
}

export default function ReviewSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ReviewSessionContent />
    </Suspense>
  );
}
