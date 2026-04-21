"use client";

import { useEffect, useRef } from "react";

interface ImagePreloaderProps {
  urls: (string | null)[];
}

/**
 * Warm the browser's HTTP cache for upcoming card images so there's no
 * blank-image flash when the user advances. Uses `new Image()` — the fetch
 * runs in the background, the browser deduplicates with the eventual <img>
 * render, and no DOM nodes are left behind.
 *
 * Tracks already-requested URLs in a ref so re-renders within the same
 * session don't re-trigger fetches. Paired with a 1-year `cacheControl`
 * on Supabase storage, the first cycle through a deck warms the cache
 * and every subsequent session is instant.
 */
export function ImagePreloader({ urls }: ImagePreloaderProps) {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const url of urls) {
      if (!url) continue;
      if (seen.current.has(url)) continue;
      seen.current.add(url);
      const img = new Image();
      img.src = url;
    }
  }, [urls]);

  return null;
}
