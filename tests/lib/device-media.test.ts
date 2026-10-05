import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
import { downloadMedia, releaseMediaMemory, savedMedia, validMediaUrl } from "@/lib/device-media";
import { listRecords } from "@/lib/device-db";
const url = (id: string) => `https://test.supabase.co/storage/v1/object/public/card-audio/${id}.mp3`;
const response = () => new Response(new Blob(["audio"], { type: "audio/mpeg" }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  releaseMediaMemory();
});
describe("persistent media downloads", () => {
  it("accepts only public media on the configured storage host", () => {
    expect(validMediaUrl(url("one"))).toBe(true);
    expect(validMediaUrl("https://evil.test/storage/v1/object/public/image.png")).toBe(false);
    expect(validMediaUrl("https://test.supabase.co/auth/v1/user")).toBe(false);
  });
  it("restores downloaded bytes without another network request", async () => {
    const owner = crypto.randomUUID();
    const fetcher = vi.fn().mockImplementation(async () => response()); vi.stubGlobal("fetch", fetcher);
    await downloadMedia(owner, url("one"));
    releaseMediaMemory();
    expect(await savedMedia(owner, url("one"))).toMatch(/^blob:/);
    await downloadMedia(owner, url("one"));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await savedMedia("another-account", url("one"))).toBeNull();
  });
  it("does not save an HTML error as an audio download", async () => {
    const owner = crypto.randomUUID();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("error", { headers: { "Content-Type": "text/html" } })));
    await expect(downloadMedia(owner, url("bad"))).rejects.toThrow("Invalid media");
    expect(await listRecords(owner)).toEqual([]);
  });
  it("keeps at most two network transfers in flight", async () => {
    const owner = crypto.randomUUID();
    const complete: (() => void)[] = [];
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>(resolve => complete.push(() => resolve(response()))));
    vi.stubGlobal("fetch", fetcher);
    const jobs = ["one", "two", "three"].map(id => downloadMedia(owner, url(id)));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    complete[0]();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    complete[1](); complete[2]();
    await Promise.all(jobs);
  });
  it("does not repopulate downloads after storage is cleared", async () => {
    const owner = crypto.randomUUID();
    let complete!: () => void;
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { complete = () => resolve(response()); }));
    vi.stubGlobal("fetch", fetcher);
    const job = downloadMedia(owner, url("late"));
    const rejected = expect(job).rejects.toThrow("cancelled");
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    releaseMediaMemory(); complete();
    await rejected;
    expect(await listRecords(owner)).toEqual([]);
  });
});
