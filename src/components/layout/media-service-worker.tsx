"use client";

import { useEffect } from "react";
import { registerMediaServiceWorker } from "@/lib/offline-cache";

/**
 * Registers the offline-media service worker on every load. Doing it
 * app-wide (not just when reminders are enabled) means the SW is active
 * to serve downloaded audio/images from the device cache. Idempotent —
 * re-registering the same script is a no-op.
 */
export function MediaServiceWorker() {
  useEffect(() => {
    void registerMediaServiceWorker();
  }, []);
  return null;
}
