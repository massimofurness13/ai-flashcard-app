"use client";

import { useRouter } from "next/navigation";
import { StudySession } from "@/components/study/study-session";

interface StudyClientProps {
  deckId: string;
  deckName: string;
  frontVoice?: string | null;
  backVoice?: string | null;
  cards: {
    id: string;
    front: string;
    back: string;
    imageUrl: string | null;
    hint: string | null;
  }[];
}

export function StudyClient({ deckId, deckName, frontVoice, backVoice, cards }: StudyClientProps) {
  const router = useRouter();

  return (
    <StudySession
      cards={cards}
      deckName={deckName}
      frontVoice={frontVoice}
      backVoice={backVoice}
      onComplete={() => router.push(`/decks/${deckId}`)}
    />
  );
}
