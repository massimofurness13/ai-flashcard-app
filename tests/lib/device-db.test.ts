import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { readRecord, writeRecord, deleteRecord, listRecords } from "@/lib/device-db";

describe("account-separated device storage", () => {
  it("stores and restores structured card data", async () => {
    await writeRecord("a", "query:library", { cards: [{ front: "nariz", back: "nose" }] });
    expect((await readRecord("a", "query:library"))?.value).toEqual({ cards: [{ front: "nariz", back: "nose" }] });
  });
  it("never reads another account's records", async () => {
    expect(await readRecord("b", "query:library")).toBeUndefined();
    expect(await listRecords("b")).toEqual([]);
  });
  it("preserves file bytes", async () => {
    await writeRecord("a", "media:test", new Blob(["test"], { type: "audio/mpeg" }));
    expect(await (await readRecord<Blob>("a", "media:test"))?.value.text()).toBe("test");
  });
  it("deletes only the named owner's file", async () => {
    await writeRecord("b", "media:test", "keep");
    await deleteRecord("a", "media:test");
    expect(await readRecord("a", "media:test")).toBeUndefined();
    expect((await readRecord("b", "media:test"))?.value).toBe("keep");
  });
  it("refuses anonymous writes", async () => {
    await expect(writeRecord("", "private", 1)).rejects.toThrow("account");
  });
  it("reads only review records without loading downloaded media", async () => {
    await writeRecord("prefix-test", "media:audio", new Blob(["audio"]));
    await writeRecord("prefix-test", "review:one", { cardId: "one" });
    expect((await listRecords("prefix-test", "review:")).map(r => r.key)).toEqual(["review:one"]);
  });
});
