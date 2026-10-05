"use client";
import { HomePage } from "./home-client";
import { LandingPage } from "./landing";
import type { ComponentProps } from "react";
import { useDeviceAccount } from "@/components/layout/device-provider";
import { useDeviceQuery } from "@/hooks/use-device-query";
import { SavedDataState } from "@/components/layout/saved-data-state";
export default function Home() {
  const { user, ready } = useDeviceAccount();
  const { data, error, refresh } = useDeviceQuery<ComponentProps<typeof HomePage>>("/api/library");
  if (!ready) return <SavedDataState retry={refresh} />;
  if (!user || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "landing")) return <LandingPage />;
  if (!data) return <SavedDataState error={error} retry={refresh} />;
  return <>{error && <p role="status" className="mb-2 text-xs text-muted-foreground">{error}</p>}<HomePage {...data} /></>;
}
