import { beforeEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({mediaStatus: vi.fn(), read: vi.fn()}));
vi.mock("@/lib/native-device", () => ({isNativeDevice: () => true, NativeStore: native}));
import { savedMediaUrls } from "@/lib/device-db";
beforeEach(() => vi.clearAllMocks());
describe("native media availability", () => {
  it("checks a large pack in bounded metadata batches without reading file bytes", async () => {
    native.mediaStatus.mockImplementation(async ({keys}) => ({keys}));
    const urls = Array.from({length: 1466}, (_, i) => `https://media.invalid/${i}`);
    const result = await savedMediaUrls("account-a", urls);
    expect(result.size).toBe(1466);
    expect(native.mediaStatus).toHaveBeenCalledTimes(3);
    expect(native.mediaStatus.mock.calls.every(([args]) => args.owner === "account-a" && args.keys.length <= 500)).toBe(true);
    expect(native.read).not.toHaveBeenCalled();
  });
  it("does not mark missing or evicted files as saved", async () => {
    native.mediaStatus.mockResolvedValue({keys:["media:present"]});
    expect([...await savedMediaUrls("account-b", ["present", "missing"])]).toEqual(["present"]);
  });
  it("surfaces storage failure instead of claiming offline readiness", async () => {
    native.mediaStatus.mockRejectedValue(new Error("storage unavailable"));
    await expect(savedMediaUrls("account-a", ["one"])).rejects.toThrow("storage unavailable");
  });
});
