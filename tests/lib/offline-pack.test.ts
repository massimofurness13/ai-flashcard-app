import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ owner: vi.fn(), download: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/device-media", () => ({ deviceOwner: mock.owner, downloadMedia: mock.download, resolveSavedAudio: mock.resolve, audioKey: (t: string, l: string) => `audio:${l}:${t}` }));
import { downloadPack, isPackDownloaded, type DownloadPackInput } from "@/lib/offline-cache";
import { writeRecord, deleteRecord } from "@/lib/device-db";
const pack: DownloadPackInput = { deckId: "pack1", cards: [{ front: "hola", back: "hello", imageUrl: "https://image" }], frontLanguageCode: "es-ES", backLanguageCode: "en-GB", learningLanguage: "es" };
beforeEach(() => {
  vi.stubGlobal("navigator", { storage: { persist: vi.fn().mockResolvedValue(true) } });
  mock.owner.mockResolvedValue(crypto.randomUUID());
  mock.resolve.mockResolvedValue(null);
  mock.download.mockImplementation(async (owner, url) => { await writeRecord(owner, `media:${url}`, new Blob(["ok"])); return "blob:local"; });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ audioUrl: "https://audio" }) }));
});
describe("verified pack download", () => {
  it("marks complete only after all media is saved", async () => {
    expect(await isPackDownloaded(pack)).toBe(false);
    await downloadPack(pack);
    expect(await isPackDownloaded(pack)).toBe(true);
  });
  it("never marks a partial file download complete", async () => {
    mock.download.mockRejectedValueOnce(new Error("quota"));
    await expect(downloadPack(pack)).rejects.toThrow("quota");
    expect(await isPackDownloaded(pack)).toBe(false);
  });
  it("never marks failed audio generation complete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(downloadPack(pack)).rejects.toThrow("audio");
    expect(await isPackDownloaded(pack)).toBe(false);
  });
  it("detects an evicted file", async () => {
    await downloadPack(pack);
    await deleteRecord(await mock.owner(), "media:https://image");
    expect(await isPackDownloaded(pack)).toBe(false);
  });
  it("invalidates downloads after card text or voice changes", async () => {
    await downloadPack(pack);
    expect(await isPackDownloaded({ ...pack, backLanguageCode: "en-US" })).toBe(false);
    expect(await isPackDownloaded({ ...pack, cards: [{ ...pack.cards[0], front: "adiós" }] })).toBe(false);
  });
});
