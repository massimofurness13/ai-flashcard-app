import { deviceOwner } from "./device-media";

interface RecordingResponse { status: number; audioUrl: string | null }
const pending = new Map<string, Promise<RecordingResponse>>();
/** Playback and automatic daily downloads share an in-flight generation call. */
export async function requestAudioRecording(text: string, languageCode: string): Promise<RecordingResponse> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return {status: 0, audioUrl: null};
  const owner = await deviceOwner().catch(() => null);
  const key = JSON.stringify([owner, languageCode, text.trim()]);
  const existing = pending.get(key); if (existing) return existing;
  const task = (async () => {
    const response = await fetch("/api/tts", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({text, languageCode}), redirect: "error", signal: AbortSignal.timeout(10000),
    });
    const data = response.ok ? await response.json() as {audioUrl?: unknown} : null;
    if (await deviceOwner().catch(() => null) !== owner) return {status: 0, audioUrl: null};
    return {status: response.status, audioUrl: typeof data?.audioUrl === "string" ? data.audioUrl : null};
  })().catch(() => ({status: 0, audioUrl: null})).finally(() => { if (pending.get(key) === task) pending.delete(key); });
  pending.set(key, task); return task;
}
