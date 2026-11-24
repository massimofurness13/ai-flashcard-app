import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

import * as db from "@/lib/device-db";
import { audioKey, releaseMediaMemory, setDeviceOwner } from "@/lib/device-media";
import { startDailyAudioSync, syncDailyAudio } from "@/lib/daily-audio-sync";
import { requestAudioRecording } from "@/lib/audio-request";
import type { SavedStudy } from "@/lib/offline-study";
import type { StudyResumeCard } from "@/lib/study-resume";

const url = (text: string, language = "es-MX") =>
  `https://test.supabase.co/storage/v1/object/public/card-audio/${language}/${encodeURIComponent(text)}.mp3`;
const audio = () => new Response(new Blob(["synthetic audio bytes"], { type: "audio/mpeg" }));
const card = (id: string, front = `front ${id}`, back = `back ${id}`): StudyResumeCard => ({
  id, front, back, imageUrl: "https://unused.test/image.png", imageTier: null, hint: null,
  deck: { id: "pack", name: "Synthetic", emoji: null, frontLanguageCode: "es-MX", backLanguageCode: "en-GB" },
});
const study = (cards = [card("one")], day = "2026-11-24"): SavedStudy => ({
  cards, learningLanguage: "es",
  daily: { day, timingKey: "existing-plan", total: cards.length, completed: 1, ratings: { 3: 1 },
    mix: { practice: cards.length, retention: 0, new: 0 } },
});
let owner: string;
let fetcher: ReturnType<typeof vi.fn<(input: string, init?: RequestInit) => Promise<Response>>>;
let scheduled: ReturnType<typeof startDailyAudioSync> | undefined;
const requests = () => fetcher.mock.calls.filter(([input]) => input === "/api/tts")
  .map(([, init]) => JSON.parse(init!.body as string) as { text: string; languageCode: string });
const transfers = () => fetcher.mock.calls.filter(([input]) => input !== "/api/tts").map(([input]) => input);
async function seed(value = study(), timeZone = "Europe/London") {
  await db.writeRecord(owner, "study:daily", value);
  await db.writeRecord(owner, "library:manifest", { deckIds: ["huge-unrelated-pack"], timeZone });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-24T12:00:00Z"));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  owner = crypto.randomUUID();
  releaseMediaMemory();
  setDeviceOwner(owner);
  fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    if (input !== "/api/tts") return audio();
    const body = JSON.parse(init!.body as string);
    return Response.json({ audioUrl: url(body.text, body.languageCode) });
  });
  vi.stubGlobal("fetch", fetcher);
});

afterEach(() => {
  scheduled?.stop(); scheduled = undefined;
  releaseMediaMemory(); setDeviceOwner(null);
  expect(auth.getSession).not.toHaveBeenCalled();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers();
});

describe("daily audio disk worker", () => {
  it("saves both sides as bytes, deduplicates clips, and preserves the daily plan and checkpoint", async () => {
    const saved = study([card("one", " hola ", "hello"), card("two", "hola", "goodbye")]);
    await seed(saved);
    await db.writeRecord(owner, "plan:2026-11-24", { picks: [{ id: "one" }], createdAt: "original" });
    await db.writeRecord(owner, "checkpoint:study:daily", { currentIndex: 1, answer: "unsynced draft" });
    const original = await db.listRecords(owner);
    const read = vi.spyOn(db, "readRecord");
    const blobs = vi.spyOn(URL, "createObjectURL");
    await syncDailyAudio(owner);
    expect(requests()).toEqual([
      { text: "hola", languageCode: "es-MX" }, { text: "hello", languageCode: "en-GB" },
      { text: "goodbye", languageCode: "en-GB" },
    ]);
    expect(transfers()).toHaveLength(3);
    for (const target of transfers()) expect((await db.readRecord<Blob>(owner, `media:${target}`))?.value.size).toBeGreaterThan(0);
    const unchanged = (await db.listRecords(owner)).filter(r => !r.key.startsWith("audio:") && !r.key.startsWith("media:"));
    expect(unchanged).toEqual(original);
    expect(read.mock.calls.some(([, key]) => key.startsWith("query:/api/decks/"))).toBe(false);
    expect(blobs).not.toHaveBeenCalled();
  });

  it("uses playback language fallbacks without guessing an unknown front language", async () => {
    const fallback = card("one");
    fallback.deck.frontLanguageCode = null; fallback.deck.backLanguageCode = null;
    await seed(study([fallback]));
    await syncDailyAudio(owner);
    expect(requests().map(r => r.languageCode)).toEqual(["es-ES", "en-GB"]);
    fetcher.mockClear();
    await seed({ ...study([card("unknown", "unvoiced", "translation")]), learningLanguage: null,
      cards: [{ ...fallback, front: "unvoiced", back: "translation" }] });
    await syncDailyAudio(owner);
    expect(requests()).toEqual([{ text: "translation", languageCode: "en-GB" }]);
  });

  it("does no work offline or for a different owner, even before consulting auth", async () => {
    await seed();
    const read = vi.spyOn(db, "readRecord");
    Object.assign(navigator, { onLine: false });
    await syncDailyAudio(owner);
    expect(read).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
    Object.assign(navigator, { onLine: true }); setDeviceOwner("different-owner");
    await syncDailyAudio(owner);
    expect(read).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });

  it("ignores old or absent daily sets and never creates a set from a plan", async () => {
    await db.writeRecord(owner, "plan:2026-11-24", { picks: [{ id: "one" }] });
    await syncDailyAudio(owner);
    await seed(study(undefined, "2026-11-23")); await syncDailyAudio(owner);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the saved library timezone, with the same UTC fallback as study loading", async () => {
    await seed(study(undefined, "2026-11-25"), "Pacific/Auckland");
    await syncDailyAudio(owner); expect(transfers()).toHaveLength(2);
    fetcher.mockClear();
    await seed(study([card("utc")]), "invalid/timezone");
    await syncDailyAudio(owner); expect(transfers()).toHaveLength(2);
  });

  it("resumes a missing file without re-preparing URLs or re-downloading saved bytes", async () => {
    await seed();
    let fail = true;
    const normal = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (input, init) => input === url("front one") && fail
      ? new Response("temporary", { status: 503 }) : normal(input, init));
    await syncDailyAudio(owner);
    expect(requests()).toHaveLength(2);
    expect(await db.readRecord(owner, `media:${url("front one")}`)).toBeUndefined();
    fail = false; fetcher.mockClear(); releaseMediaMemory();
    await syncDailyAudio(owner);
    expect(requests()).toEqual([]); expect(transfers()).toEqual([url("front one")]);
    fetcher.mockClear(); await syncDailyAudio(owner); expect(fetcher).not.toHaveBeenCalled();
    // An evicted file is recovered, even after a fully successful pass.
    await db.deleteRecord(owner, `media:${url("back one", "en-GB")}`);
    await syncDailyAudio(owner);
    expect(transfers()).toEqual([url("back one", "en-GB")]);
  });

  it("shares overlapping passes and bounds preparation and transfers to two jobs", async () => {
    await seed(study([card("one"), card("two"), card("three")]));
    let inFlight = 0, maximum = 0;
    const release: Array<() => void> = [];
    const normal = fetcher.getMockImplementation()!;
    fetcher.mockImplementation((input, init) => new Promise<Response>(resolve => {
      maximum = Math.max(maximum, ++inFlight);
      release.push(() => { inFlight--; void normal(input, init).then(resolve); });
    }));
    const first = syncDailyAudio(owner);
    expect(syncDailyAudio(owner)).toBe(first);
    for (let i = 0; i < 12; i++) {
      await vi.waitFor(() => expect(release.length).toBeGreaterThan(0));
      release.shift()!();
    }
    await first;
    expect(maximum).toBe(2); expect(inFlight).toBe(0);
    expect(requests()).toHaveLength(6); expect(transfers()).toHaveLength(6);
  });

  it.each(["owner", "offline"])("discards late prepared URLs after an %s change", async change => {
    await seed(study([card("one"), card("two")]));
    const release: Array<() => void> = [];
    fetcher.mockImplementation(() => new Promise<Response>(resolve => {
      release.push(() => resolve(Response.json({ audioUrl: url("late") })));
    }));
    const job = syncDailyAudio(owner);
    await vi.waitFor(() => expect(release).toHaveLength(2));
    if (change === "owner") setDeviceOwner("other"); else Object.assign(navigator, { onLine: false });
    release.forEach(done => done()); await job;
    expect(await db.listRecords(owner, "audio:")).toEqual([]);
    expect(await db.listRecords(owner, "media:")).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("shares foreground preparation instead of generating the same clip twice", async () => {
    await seed(study([card("one", "hola", " ")]));
    let finish!: () => void;
    const normal = fetcher.getMockImplementation()!;
    fetcher.mockImplementation((input, init) => input === "/api/tts"
      ? new Promise<Response>(resolve => { finish = () => resolve(Response.json({ audioUrl: url("hola") })); })
      : normal(input, init));
    const foreground = requestAudioRecording("hola", "es-MX");
    await vi.waitFor(() => expect(requests()).toHaveLength(1));
    const lookup = vi.spyOn(db, "readRecord");
    const job = syncDailyAudio(owner);
    await vi.waitFor(() => expect(lookup.mock.calls.some(([, key]) => key === audioKey("hola", "es-MX"))).toBe(true));
    finish(); await Promise.all([foreground, job]);
    expect(requests()).toHaveLength(1); expect(transfers()).toEqual([url("hola")]);
  });

  it("does not commit in-flight media across the provider's account boundary", async () => {
    await seed();
    await db.writeRecord(owner, audioKey("front one", "es-MX"), url("front one"));
    await db.writeRecord(owner, audioKey("back one", "en-GB"), url("back one", "en-GB"));
    const release: Array<() => void> = [];
    fetcher.mockImplementation(() => new Promise<Response>(resolve => release.push(() => resolve(audio()))));
    const job = syncDailyAudio(owner);
    await vi.waitFor(() => expect(release).toHaveLength(2));
    releaseMediaMemory(); setDeviceOwner("other");
    release.forEach(done => done()); await job;
    expect(await db.listRecords(owner, "media:")).toEqual([]);
    expect(await db.listRecords("other")).toEqual([]);
  });

  it.each([401, 403, 429])("stops preparing on HTTP %s but still saves known public URLs", async status => {
    await seed(study([card("one"), card("two")]));
    await db.writeRecord(owner, audioKey("back two", "en-GB"), url("known", "en-GB"));
    fetcher.mockImplementation(async input => input === "/api/tts" ? new Response(null, { status }) : audio());
    await syncDailyAudio(owner);
    expect(requests().length).toBeLessThanOrEqual(2);
    expect(transfers()).toEqual([url("known", "en-GB")]);
  });

  it("saves known URLs with a saved account, without TTS preparation or auth refresh", async () => {
    await seed();
    await db.writeRecord(owner, audioKey("back one", "en-GB"), url("known", "en-GB"));
    await syncDailyAudio(owner, { canPrepare: () => false });
    expect(requests()).toEqual([]); expect(transfers()).toEqual([url("known", "en-GB")]);
  });

  it("does not persist invalid prepared URLs", async () => {
    await seed();
    fetcher.mockResolvedValue(Response.json({ audioUrl: "https://untrusted.test/audio.mp3" }));
    await syncDailyAudio(owner);
    expect(await db.listRecords(owner, "audio:")).toEqual([]); expect(transfers()).toEqual([]);
  });

  it("stops on storage quota failure without changing study records", async () => {
    await seed(study([card("one"), card("two")]));
    const original = await db.listRecords(owner);
    vi.spyOn(db, "writeRecord").mockRejectedValue(new DOMException("Full", "QuotaExceededError"));
    await syncDailyAudio(owner);
    expect(requests().length).toBeLessThanOrEqual(2);
    expect(await db.listRecords(owner)).toEqual(original);
  });
});

it("a media reset during generation prevents late downloads from resurrecting removed files", async () => {
  await seed();
  const responses: Array<() => void> = [];
  fetcher.mockImplementation((input, init) => {
    if (input !== "/api/tts") return Promise.resolve(audio());
    const body = JSON.parse(init!.body as string);
    return new Promise(resolve => responses.push(() => resolve(Response.json({audioUrl:url(body.text, body.languageCode)}))));
  });
  const pass = syncDailyAudio(owner);
  await vi.waitFor(() => expect(responses).toHaveLength(2));
  releaseMediaMemory();
  responses.forEach(finish => finish());
  await pass;
  expect(transfers()).toEqual([]);
  expect(await db.listRecords(owner, "audio:")).toEqual([]);
});

describe("automatic daily audio scheduling", () => {
  async function start() {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    scheduled = startDailyAudioSync(owner);
    await vi.advanceTimersByTimeAsync(1000);
    await syncDailyAudio(owner);
  }

  it("does not feed media-saved events back into repeated passes", async () => {
    await seed();
    const read = vi.spyOn(db, "readRecord");
    await start();
    expect(transfers()).toHaveLength(2);
    read.mockClear();
    for (let i = 0; i < 100; i++) window.dispatchEvent(new CustomEvent("huella:media-saved", { detail: { owner } }));
    await vi.advanceTimersByTimeAsync(10000);
    expect(read).not.toHaveBeenCalled();
  });

  it("discovers a daily set saved later during study and coalesces navigation wake-ups", async () => {
    await start(); expect(fetcher).not.toHaveBeenCalled();
    await seed();
    for (let i = 0; i < 10; i++) scheduled!.kick();
    await vi.advanceTimersByTimeAsync(999); expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await syncDailyAudio(owner);
    expect(transfers()).toHaveLength(2);
    // Plans saved without events are discovered while the study screen stays open.
    await seed(study([card("later")]));
    await vi.advanceTimersByTimeAsync(60000); await syncDailyAudio(owner);
    expect(transfers()).toHaveLength(4);
  });

  it("retries on reconnect and removes listeners and timers on cleanup", async () => {
    await seed(); Object.assign(navigator, { onLine: false });
    await start(); expect(fetcher).not.toHaveBeenCalled();
    Object.assign(navigator, { onLine: true }); window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(1000); await syncDailyAudio(owner);
    expect(transfers()).toHaveLength(2);
    const read = vi.spyOn(db, "readRecord");
    scheduled!.stop(); window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new CustomEvent("huella:device-saved", { detail: { owner, key: "study:daily" } }));
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(120000);
    expect(read).not.toHaveBeenCalled();
  });

  it("wakes for study:daily changes but ignores unrelated or other-owner saves", async () => {
    await start(); await seed();
    window.dispatchEvent(new CustomEvent("huella:device-saved", { detail: { owner: "other", key: "study:daily" } }));
    window.dispatchEvent(new CustomEvent("huella:device-saved", { detail: { owner, url: "/api/images/quota" } }));
    await vi.advanceTimersByTimeAsync(1000); expect(fetcher).not.toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent("huella:device-saved", { detail: { owner, key: "study:daily" } }));
    await vi.advanceTimersByTimeAsync(1000); await syncDailyAudio(owner);
    expect(transfers()).toHaveLength(2);
  });
});
