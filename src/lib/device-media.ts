import { readRecord, writeRecord } from "@/lib/device-db";
import { createClient } from "@/lib/supabase/client";

const blobs = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
let downloads = 0;
const waiting: (() => void)[] = [];
let activeOwner: string | null | undefined;
let mediaGeneration = 0;
export function setDeviceOwner(owner: string | null) { activeOwner = owner; }
export async function deviceOwner(): Promise<string | null> {
  if (activeOwner !== undefined) return activeOwner;
  const { data } = await createClient().auth.getSession();
  return data.session?.user.id ?? null;
}
export function validMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
    return url.protocol === "https:" && url.host === host && url.pathname.startsWith("/storage/v1/object/public/");
  } catch { return false; }
}
function remember(owner: string, url: string, blob: Blob): string {
  const key = `${owner}:${url}`;
  const existing = blobs.get(key);
  if (existing) return existing;
  const local = URL.createObjectURL(blob);
  blobs.set(key, local);
  return local;
}
export function releaseMediaMemory() {
  mediaGeneration++;
  pending.clear();
  for (const value of blobs.values()) URL.revokeObjectURL(value);
  blobs.clear();
}
export async function savedMedia(owner: string, url: string): Promise<string | null> {
  const generation = mediaGeneration;
  const memory = blobs.get(`${owner}:${url}`);
  if (memory) return memory;
  const record = await readRecord<Blob>(owner, `media:${url}`);
  if (generation !== mediaGeneration) return null;
  return record?.value?.size ? remember(owner, url, record.value) : null;
}
export async function downloadMedia(owner: string, url: string): Promise<string> {
  const generation = mediaGeneration;
  if (!validMediaUrl(url)) throw new Error("Unsupported media URL.");
  const key = `${owner}:${url}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const job = (async () => {
    const saved = await savedMedia(owner, url);
    if (saved) return saved;
    // Two transfers at a time; don't flood the audio connection pool.
    if (downloads >= 2) await new Promise<void>(resolve => waiting.push(resolve));
    else downloads++;
    try {
      if (generation !== mediaGeneration) throw new Error("Download cancelled.");
      const response = await fetch(url, { cache: "force-cache", signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("A file could not be downloaded.");
      const blob = await response.blob();
      if (!blob.size || !/^(audio|image)\//.test(blob.type)) throw new Error("Invalid media file.");
      if (generation !== mediaGeneration) throw new Error("Download cancelled.");
      await writeRecord(owner, `media:${url}`, blob);
      if (generation !== mediaGeneration) throw new Error("Download cancelled.");
      return remember(owner, url, blob);
    } finally {
      const next = waiting.shift();
      if (next) next(); // Transfer this slot directly to the next waiting download.
      else downloads--;
    }
  })().finally(() => { if (pending.get(key) === job) pending.delete(key); });
  pending.set(key, job);
  return job;
}

export const audioKey = (text: string, language: string) => `audio:v1:${language}:${text.trim()}`;
export async function resolveSavedAudio(owner: string, text: string, language: string): Promise<string | null> {
  return (await readRecord<string>(owner, audioKey(text, language)))?.value ?? null;
}
