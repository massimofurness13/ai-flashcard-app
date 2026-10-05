import { fallbackVoiceCodes } from "@/lib/language-codes";
import { audioKey, deviceOwner, downloadMedia, resolveSavedAudio } from "@/lib/device-media";
import { readRecord, writeRecord } from "@/lib/device-db";

export async function registerMediaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js"); } catch { return null; }
}
export interface DownloadCard { front: string; back: string; imageUrl: string | null }
export interface DownloadPackInput {
  deckId: string; cards: DownloadCard[]; frontLanguageCode: string | null;
  backLanguageCode: string | null; learningLanguage: string | null;
}
export type DownloadProgress = { phase: "prepare" | "save"; done: number; total: number };
interface Manifest { signature: string; urls: string[] }
function signature(input: DownloadPackInput) {
  return JSON.stringify([input.cards, input.frontLanguageCode, input.backLanguageCode, input.learningLanguage]);
}
export async function isPackDownloaded(input: DownloadPackInput): Promise<boolean> {
  const owner = await deviceOwner();
  if (!owner) return false;
  try {
    const record = await readRecord<Manifest>(owner, `pack:${input.deckId}`);
    if (!record || record.value.signature !== signature(input)) return false;
    for (const url of record.value.urls) {
      if (!(await readRecord<Blob>(owner, `media:${url}`))?.value?.size) return false;
    }
    return true;
  } catch { return false; }
}
export async function downloadPack(input: DownloadPackInput, onProgress?: (progress: DownloadProgress) => void): Promise<{ mediaCount: number }> {
  const owner = await deviceOwner();
  if (!owner) throw new Error("Sign in before downloading.");
  await navigator.storage?.persist?.().catch(() => false);
  const fallback = fallbackVoiceCodes(input.learningLanguage);
  const front = input.frontLanguageCode || fallback.front;
  const back = input.backLanguageCode || fallback.back;
  const clips = input.cards.flatMap(card => [
    ...(front && card.front.trim() ? [{ text: card.front, language: front }] : []),
    ...(back && card.back.trim() ? [{ text: card.back, language: back }] : []),
  ]);
  const urls = new Set(input.cards.map(card => card.imageUrl).filter((url): url is string => !!url));
  let done = 0;
  // Sequential audio lookup keeps large packs below the TTS rate limit.
  for (const clip of clips) {
    let url = await resolveSavedAudio(owner, clip.text, clip.language);
    if (!url) {
      const response = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clip.text, languageCode: clip.language }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error("Some audio couldn't be prepared. Retry to resume.");
      url = (await response.json()).audioUrl;
      if (!url) throw new Error("Missing audio file.");
      await writeRecord(owner, audioKey(clip.text, clip.language), url);
    }
    urls.add(url);
    onProgress?.({ phase: "prepare", done: ++done, total: clips.length });
  }
  done = 0;
  for (const url of urls) {
    await downloadMedia(owner, url);
    onProgress?.({ phase: "save", done: ++done, total: urls.size });
  }
  // Only commit completion once EVERY required file has been saved.
  await writeRecord(owner, `pack:${input.deckId}`, { signature: signature(input), urls: [...urls] });
  return { mediaCount: urls.size };
}
