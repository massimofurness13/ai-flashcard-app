import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ owner: vi.fn() }));
vi.mock("@/lib/device-media", () => ({ deviceOwner: mock.owner }));
import { queueReview, flushReviews } from "@/lib/review-outbox";
import { listRecords } from "@/lib/device-db";
let owner: string;
beforeEach(() => {
  owner = crypto.randomUUID(); mock.owner.mockResolvedValue(owner);
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
});
describe("durable reviews", () => {
  it("survives failed requests and retries the exact same identifier", async () => {
    await queueReview("card", 4); await flushReviews(owner);
    const first = (await listRecords(owner))[0];
    expect(first.value).toMatchObject({ cardId: "card", quality: 4 });
    const sent = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", sent);
    await flushReviews(owner);
    expect(JSON.parse(sent.mock.calls[0][1].body)).toEqual(first.value);
    expect(await listRecords(owner)).toEqual([]);
  });
  it("does not send account A's reviews after switching to B", async () => {
    await queueReview("card", 1); await flushReviews(owner);
    mock.owner.mockResolvedValue("other");
    const sent = vi.fn(); vi.stubGlobal("fetch", sent);
    await flushReviews(owner);
    expect(sent).not.toHaveBeenCalled();
    expect(await listRecords(owner)).toHaveLength(1);
  });
  it("retains a deleted-card review with an actionable error", async () => {
    await queueReview("deleted", 4); await flushReviews(owner);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: "Card not found" }) }));
    await flushReviews(owner);
    expect((await listRecords(owner))[0].value).toMatchObject({ error: "Card not found" });
  });
  it("deduplicates overlapping flush attempts", async () => {
    await queueReview("card", 4); await flushReviews(owner);
    const sent = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", sent);
    await Promise.all([flushReviews(owner), flushReviews(owner), flushReviews(owner)]);
    expect(sent).toHaveBeenCalledTimes(1);
  });
  it("continues syncing other cards after a deleted-card error", async () => {
    await queueReview("deleted", 4); await flushReviews(owner);
    await queueReview("valid", 4); await flushReviews(owner);
    const sent = vi.fn().mockImplementation((_url, options) => Promise.resolve(
      JSON.parse(options.body).cardId === "deleted"
        ? { ok: false, status: 404, json: async () => ({ error: "Card not found" }) }
        : { ok: true }
    ));
    vi.stubGlobal("fetch", sent);
    await flushReviews(owner);
    expect(sent).toHaveBeenCalledTimes(2);
    expect(await listRecords(owner, "review:")).toHaveLength(1);
    expect((await listRecords(owner, "review:"))[0].value).toMatchObject({ cardId: "deleted", error: "Card not found" });
  });
});
