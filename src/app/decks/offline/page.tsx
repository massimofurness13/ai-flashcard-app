"use client";
import { Suspense, useEffect, useState, type ComponentProps } from "react";
import { DeckView } from "../[deckId]/deck-view";
import { useDeviceQuery } from "@/hooks/use-device-query";
import { SavedDataState } from "@/components/layout/saved-data-state";
/** Public reusable document; account data is loaded exclusively from device storage/auth APIs. */
export default function OfflineDeckPage() {
  const [id,setId]=useState("");
  // The cached public document has no account/pack props; hydrate from the actual navigation URL.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{setId(window.location.pathname.split("/")[2] || "");},[]);
  const {data,error,refresh}=useDeviceQuery<ComponentProps<typeof DeckView>>(`/api/decks/${encodeURIComponent(id)}/view`,!!id&&id!=="offline");
  if(!data)return <SavedDataState error={error} retry={refresh}/>;
  return <Suspense><DeckView {...data}/></Suspense>;
}
