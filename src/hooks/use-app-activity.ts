"use client";
import { useSyncExternalStore } from "react";
import { getAppActivity, getServerAppActivity, subscribeAppActivity } from "@/lib/app-activity";
export function useAppActivity() {
  return useSyncExternalStore(subscribeAppActivity, getAppActivity, getServerAppActivity);
}
