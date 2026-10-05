"use client";
import { Suspense, type ComponentProps } from "react";
import { StudyConfig } from "./study-config";
import { useDeviceQuery } from "@/hooks/use-device-query";
import { SavedDataState } from "@/components/layout/saved-data-state";
function SavedStudyConfig() {
  const { data, error, refresh } = useDeviceQuery<ComponentProps<typeof StudyConfig>>("/api/study-config");
  if (!data) return <SavedDataState error={error} retry={refresh} />;
  return <StudyConfig {...data} />;
}
export default function StudyPage() {
  return <Suspense><SavedStudyConfig /></Suspense>;
}
