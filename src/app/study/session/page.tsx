"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { StudySession, type StudyStats } from "@/components/study/study-session";
import { StudyCountdown } from "@/components/study/study-countdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { peekStudyResume, clearStudyResume } from "@/lib/study-resume";

interface StudyCard {
  id: string;
  front: string;
  back: string;
  imageUrl: string | null;
  imageTier: string | null;
  hint: string | null;
  deck: {
    id: string;
    name: string;
    emoji: string | null;
    frontLanguageCode?: string | null;
    backLanguageCode?: string | null;
  };
}

function StudySessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Resume snapshot, captured once on mount (declared first so the
  // state below can seed from it). When the user edited or deleted a
  // card mid-session, this holds the FULL session (cards + position +
  // stats) so we restore it verbatim instead of re-fetching /api/review
  // — a re-fetch drops every card already reviewed this session and
  // resets the progress counter. See src/lib/study-resume.
  const [resume] = useState(() => peekStudyResume());

  // Seed straight from the snapshot when resuming, so there's no
  // setState-in-effect and no loading flash on the way back from edit.
  const [cards, setCards] = useState<StudyCard[]>(() =>
    resume ? (resume.cards as StudyCard[]) : [],
  );
  const [loading, setLoading] = useState(() => resume === null);
  const [completed, setCompleted] = useState(false);
  const [stats, setStats] = useState<StudyStats | null>(null);
  // Onboarding learning language — drives the voice fallback for
  // decks with no explicit language code (so we never use the
  // robotic device voice).
  const [learningLanguage, setLearningLanguage] = useState<string | null>(
    () => resume?.learningLanguage ?? null,
  );

  // Gate the session behind a short "get ready" countdown. While it
  // runs we preload the opening cards' audio so the session starts
  // with zero delay instead of the user waiting on card 1.
  //
  // EXCEPT when resuming mid-session: the user was already in the flow,
  // so a fresh 3·2·1 would be jarring — skip straight in.
  const [prepared, setPrepared] = useState(() => resume !== null);
  const handlePrepared = useCallback(() => setPrepared(true), []);

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
    // Resuming from an edit/delete: cards/learningLanguage were already
    // seeded from the snapshot above, so there's nothing to fetch. Just
    // consume the snapshot so a later fresh session doesn't resume.
    if (resume) {
      clearStudyResume();
      return;
    }

    const params = new URLSearchParams();
    if (deckIds) params.set("deckIds", deckIds);
    params.set("limit", limit);
    params.set("filter", filter);
    if (tags) params.set("tags", tags);

    fetch(`/api/review?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setCards(data.cards);
        setLearningLanguage(data.learningLanguage ?? null);
        setLoading(false);
      });
  }, [resume, deckIds, limit, filter, tags]);

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
        <h2 className="font-editorial text-3xl font-medium sm:text-4xl">Nothing to study here</h2>
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
          <h2 className="font-editorial text-3xl font-medium sm:text-4xl">Session complete</h2>
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
              <span className="text-green-500">Knew it</span>
              <span className="font-medium">{stats.ratings[4] || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-500">Didn&apos;t know</span>
              <span className="font-medium">{stats.ratings[1] || 0}</span>
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

  // Cards are loaded but the user hasn't passed the get-ready
  // countdown yet — show it (and preload the opening audio behind it).
  if (!prepared) {
    return (
      <StudyCountdown
        cards={cards}
        learningLanguage={learningLanguage}
        onComplete={handlePrepared}
      />
    );
  }

  return (
    <StudySession
      initialCards={cards}
      learningLanguage={learningLanguage}
      autoFlipSeconds={autoFlip}
      autoAdvanceSeconds={autoAdvance}
      orientation={orientation}
      onComplete={handleComplete}
      initialIndex={resume?.currentIndex ?? 0}
      initialStats={resume?.stats}
      initialFlipped={resume?.isFlipped ?? false}
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
