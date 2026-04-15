"use client";

import { useRouter } from "next/navigation";
import { StudySession } from "@/components/study/study-session";

interface StudyClientProps {
  deckId: string;
  deckName: string;
  cards: {
    id: string;
    front: string;
    back: string;
    imageUrl: string | null;
    hint: string | null;
  }[];
}

export function StudyClient({ deckId, deckName, cards }: StudyClientProps) {
  const router = useRouter();

  return (
    <StudySession
      cards={cards}
      deckName={deckName}
      onComplete={() => router.push(`/decks/${deckId}`)}
    />
  );
}
