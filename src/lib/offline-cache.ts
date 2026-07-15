import { fallbackVoiceCodes } from "@/lib/language-codes";

/**
 * Offline pack download.
 *
 * "Download for offline" resolves every audio clip (generating any that
 * don't exist yet) + image URL for a pack, then hands the list to the
 * service worker (public/sw.js) to store on the device. After that the
 * pack plays instantly and works with no signal — the SW serves the
 * media from its cache instead of the network.
 */

const PACKS_KEY = "huella-offline-packs";

// ── Downloaded-state bookkeeping (localStorage) ─────────────────────
export function getDownloadedPacks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PACKS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function isPackDownloaded(deckId: string): boolean {
  return getDownloadedPacks().includes(deckId);
}

function markPackDownloaded(deckId: string): void {
  if (typeof window === "undefined") return;
  const set = new Set(getDownloadedPacks());
  set.add(deckId);
  try {
    localStorage.setItem(PACKS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

// ── Service worker ──────────────────────────────────────────────────
export async function registerMediaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    // Ask the OS to keep our cache around under storage pressure so a
    // downloaded pack stays downloaded.
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }
    return reg;
  } catch {
    return null;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, worker),
  );
  return results;
}

async function fetchAudioUrl(
  text: string,
  languageCode: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { audioUrl?: string };
    return data.audioUrl ?? null;
  } catch {
    return null;
  }
}

async function precacheViaServiceWorker(
  urls: string[],
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const reg = await registerMediaServiceWorker();
  if (!reg) {
    // No SW support — warm the browser HTTP cache as a best-effort
    // fallback so at least this session is fast.
    let done = 0;
    await mapConcurrent(urls, 6, async (u) => {
      try {
        await fetch(u, { mode: "cors", cache: "force-cache" });
      } catch {
        /* ignore */
      }
      onProgress(++done, urls.length);
    });
    return;
  }

  const ready = await navigator.serviceWorker.ready;
  const target = navigator.serviceWorker.controller || ready.active;
  if (!target) {
    onProgress(urls.length, urls.length);
    return;
  }

  await new Promise<void>((resolve) => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d) return;
      if (d.type === "PRECACHE_PROGRESS") onProgress(d.done, d.total);
      if (d.type === "PRECACHE_DONE") {
        navigator.serviceWorker.removeEventListener("message", onMessage);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    target.postMessage({ type: "PRECACHE", urls });
  });
}

// ── Public API ──────────────────────────────────────────────────────
export interface DownloadCard {
  front: string;
  back: string;
  imageUrl: string | null;
}

export interface DownloadPackInput {
  deckId: string;
  cards: DownloadCard[];
  frontLanguageCode: string | null;
  backLanguageCode: string | null;
  /** User's onboarding learning language — the voice fallback for a
   *  deck with no explicit language codes. */
  learningLanguage: string | null;
}

export type DownloadProgress = {
  /** "prepare" = resolving/generating audio URLs; "save" = writing to device. */
  phase: "prepare" | "save";
  done: number;
  total: number;
};

/**
 * Download a pack's audio + images to the device. Reports progress in
 * two phases: preparing (resolving audio URLs, which also generates any
 * missing clips) then saving (writing to the on-device cache).
 */
export async function downloadPack(
  input: DownloadPackInput,
  onProgress?: (p: DownloadProgress) => void,
): Promise<{ mediaCount: number }> {
  const fallback = fallbackVoiceCodes(input.learningLanguage);
  const frontLang = input.frontLanguageCode || fallback.front;
  const backLang = input.backLanguageCode || fallback.back;

  // Audio clips to resolve (skip sides with no language / no text).
  const audioItems: { text: string; lang: string }[] = [];
  for (const c of input.cards) {
    if (frontLang && c.front.trim()) {
      audioItems.push({ text: c.front, lang: frontLang });
    }
    if (backLang && c.back.trim()) {
      audioItems.push({ text: c.back, lang: backLang });
    }
  }

  // Phase 1 — resolve audio URLs (generates any that don't exist yet).
  let prepared = 0;
  const audioUrls = (
    await mapConcurrent(audioItems, 6, async (it) => {
      const url = await fetchAudioUrl(it.text, it.lang);
      onProgress?.({ phase: "prepare", done: ++prepared, total: audioItems.length });
      return url;
    })
  ).filter((u): u is string => !!u);

  // Image URLs come straight off the cards.
  const imageUrls = input.cards
    .map((c) => c.imageUrl)
    .filter((u): u is string => !!u);

  const allUrls = [...new Set([...audioUrls, ...imageUrls])];

  // Phase 2 — write everything to the device cache via the SW.
  await precacheViaServiceWorker(allUrls, (done, total) =>
    onProgress?.({ phase: "save", done, total }),
  );

  markPackDownloaded(input.deckId);
  return { mediaCount: allUrls.length };
}
