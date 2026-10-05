"use client";
import { Suspense, use, type ComponentProps } from "react";
import { DeckView } from "./deck-view";
import { useDeviceQuery } from "@/hooks/use-device-query";
import { SavedDataState } from "@/components/layout/saved-data-state";
export default function DeckPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = use(params);
  const { data, error, refresh } = useDeviceQuery<ComponentProps<typeof DeckView>>(`/api/decks/${deckId}/view`);
  if (!data) return <SavedDataState error={error} retry={refresh} />;
  return <Suspense><DeckView {...data} /></Suspense>;
}
