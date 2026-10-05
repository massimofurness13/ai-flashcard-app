import { beforeEach, describe, expect, it, vi } from "vitest";
import { readDeviceSettings, updateDeviceSettings } from "@/lib/device-settings";
let content = "{}";
beforeEach(() => {
  content = "{}";
  vi.stubGlobal("localStorage", { getItem: () => content, setItem: (_key: string, value: string) => { content = value; } });
});
describe("settings updates", () => {
  it("preserves unedited study selections and voice preferences", () => {
    content = JSON.stringify({ defaultDeckIds: ["a"], defaultFilter: "random", voice: "es-MX" });
    expect(updateDeviceSettings({ ttsSpeed: 1.2 })).toBe(true);
    expect(readDeviceSettings()).toEqual({ defaultDeckIds: ["a"], defaultFilter: "random", voice: "es-MX", ttsSpeed: 1.2 });
  });
  it("persists the new value, including off/zero", () => {
    updateDeviceSettings({ defaultAutoFlip: 1 });
    updateDeviceSettings({ defaultAutoFlip: 0 });
    expect(readDeviceSettings().defaultAutoFlip).toBe(0);
  });
  it("recovers malformed settings", () => {
    content = "broken";
    expect(updateDeviceSettings({ defaultCards: 125 })).toBe(true);
    expect(readDeviceSettings()).toEqual({ defaultCards: 125 });
  });
  it("reports quota/permission failures instead of claiming saved", () => {
    vi.stubGlobal("localStorage", { getItem: () => "{}", setItem: () => { throw new Error("quota"); } });
    expect(updateDeviceSettings({ ttsSpeed: 1 })).toBe(false);
  });
});
