import { leadingSilenceOffset } from "./audio-leading-silence";

// One unlocked output context, reusable decoded buffers, no per-card <audio>
// reload. A new lightweight source schedules an existing buffer immediately.
interface Clip { buffer: AudioBuffer; offset: number; bytes: number }
const clips = new Map<string, Clip>();
const pending = new Map<string, Promise<boolean>>();
const MAX_BYTES = 24 * 1024 * 1024;
const MAX_CLIPS = 32;
let bytes = 0, epoch = 0;
let context: AudioContext | undefined;
let waking: Promise<boolean> | undefined;
let recovering: Promise<boolean> | undefined;
let healthy = true;
function audioContext(): AudioContext | undefined {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return;
  if (!context || context.state === "closed") {
    // Where supported, speech is media playback, not a ringer-muted UI sound.
    try {
      const session = (navigator as Navigator & {audioSession?: {type: string}}).audioSession;
      if (session) session.type = "playback";
    } catch { /* Older engines use the native app's playback category. */ }
    context = new AudioContext({latencyHint: "interactive"});
  }
  return context;
}

async function resumeOutput(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === "running") return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      ctx.resume().then(() => ctx.state === "running"),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 500); }),
    ]);
  } catch { return false; }
  finally { clearTimeout(timer); }
}

/** Await iOS's asynchronous resume before choosing the compatibility player. */
export function ensurePreparedAudioRunning(): Promise<boolean> {
  if (waking) return waking;
  try {
    const ctx = audioContext();
    if (!ctx || !healthy) return Promise.resolve(false);
    if (ctx.state === "running") return Promise.resolve(true);
    const task = resumeOutput(ctx).finally(() => { if (waking === task) waking = undefined; });
    waking = task; return task;
  } catch { return Promise.resolve(false); }
}

/** Call synchronously inside Start/retry gestures to request activation. */
export function unlockPreparedAudio() { void (healthy ? ensurePreparedAudioRunning() : recoverPreparedAudio()); }

/** Foreground recovery includes WebKit's interrupted/closed and frozen-running
 * states. Recreate a broken OUTPUT only; decoded recordings remain reusable.
 * The caller cancels the interrupted source before starting this operation.
 */
export function recoverPreparedAudio(): Promise<boolean> {
  if (recovering) return recovering;
  const generation = epoch;
  const task = (async () => {
    let ctx = audioContext(); if (!ctx) return false;
    if (await resumeOutput(ctx)) {
      const before = ctx.currentTime;
      await new Promise(resolve => setTimeout(resolve, 60));
      if (generation !== epoch) return false;
      if (ctx.state === "running" && ctx.currentTime > before) { healthy = true; return true; }
    }
    if (generation !== epoch) return false;
    // iOS can report running while its render clock is still stopped.
    const old = ctx; context = undefined;
    void old.close().catch(() => {});
    ctx = audioContext();
    const resumed = !!ctx && await resumeOutput(ctx);
    if (generation !== epoch) return false;
    healthy = resumed;
    return healthy;
  })().catch(() => { if (generation === epoch) healthy = false; return false; }).finally(() => {
    if (waking === task) waking = undefined;
    if (recovering === task) recovering = undefined;
  });
  recovering = task; waking = task; return task;
}

export function isAudioPrepared(url: string): boolean { return clips.has(url); }

export function prepareAudioBuffer(url: string): Promise<boolean> {
  if (clips.has(url)) return Promise.resolve(true);
  const existing = pending.get(url); if (existing) return existing;
  const generation = epoch;
  const task = (async () => {
    const ctx = audioContext(); if (!ctx) return false;
    // Only local saved bytes. This path never turns an offline miss into HTTP.
    if (!url.startsWith("blob:")) return false;
    const response = await fetch(url, {signal: AbortSignal.timeout(5000)});
    if (!response.ok) return false;
    const encoded = await response.arrayBuffer();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const buffer = await Promise.race([
      ctx.decodeAudioData(encoded),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Audio decode timed out")), 3000); }),
    ]).finally(() => clearTimeout(timer));
    if (generation !== epoch || !buffer.length) return false;
    const size = buffer.length * buffer.numberOfChannels * 4;
    if (size > MAX_BYTES) return false;
    while (clips.size >= MAX_CLIPS || bytes + size > MAX_BYTES) {
      const oldest = clips.keys().next().value;
      if (!oldest) break;
      bytes -= clips.get(oldest)!.bytes; clips.delete(oldest);
    }
    clips.set(url, {buffer, offset: leadingSilenceOffset(buffer), bytes: size});
    bytes += size;
    return true;
  })().catch(() => false).finally(() => { if (pending.get(url) === task) pending.delete(url); });
  pending.set(url, task);
  return task;
}

/** Synchronous for a ready clip. Null means use the existing HTML fallback.
 * Non-1x playback keeps HTML's pitch preservation, rather than changing pitch
 * through AudioBufferSourceNode.playbackRate. User speed is never changed.
 */
export function playPreparedAudio(url: string, rate: number, ended: () => void, failed: () => void): (() => void) | null {
  const clip = clips.get(url), ctx = context;
  if (!clip || !ctx || waking || !healthy || ctx.state !== "running" || rate !== 1) return null;
  clips.delete(url); clips.set(url, clip);
  let stopped = false;
  let source: AudioBufferSourceNode;
  try {
    source = ctx.createBufferSource();
    source.buffer = clip.buffer;
    source.connect(ctx.destination);
  } catch { return null; }
  const cleanup = () => { clearTimeout(deadline); ctx.removeEventListener("statechange", onState); source.onended = null; source.disconnect(); };
  const stop = () => { if (stopped) return; stopped = true; cleanup(); try { source.stop(); } catch {} };
  const onState = () => {
    // iOS may interrupt the context when switching apps. Wake it on return;
    // the duration deadline still bounds a recording that never resumes.
    if (ctx.state !== "running" && typeof document !== "undefined" && document.visibilityState === "visible") unlockPreparedAudio();
  };
  const deadline = setTimeout(() => { if (!stopped) { stop(); failed(); } }, (clip.buffer.duration - clip.offset) * 1000 + 8000);
  ctx.addEventListener("statechange", onState);
  source.onended = () => { if (stopped) return; stopped = true; cleanup(); ended(); };
  try { source.start(0, clip.offset); }
  catch { stop(); return null; }
  return stop;
}

export function clearPreparedAudio() {
  epoch++; clips.clear(); pending.clear(); bytes = 0;
  waking = undefined; recovering = undefined; healthy = true;
  // Keep the same unlocked context across SPA navigation/account switches.
  // The caller cancels active speech before clearing account-owned buffers.
}
