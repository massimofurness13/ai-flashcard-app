import { afterEach, describe, expect, it, vi } from "vitest";
import { startOfTodayInTz, toLocalDateKey } from "@/lib/timezone";
afterEach(() => vi.useRealTimers());
describe("user-local midnight", () => {
  it.each([
    ["2026-10-06T18:00:00Z", "America/El_Salvador", "2026-10-06T06:00:00.000Z"],
    ["2026-10-06T03:00:00Z", "America/El_Salvador", "2026-10-05T06:00:00.000Z"],
    ["2026-10-06T18:00:00Z", "UTC", "2026-10-06T00:00:00.000Z"],
    ["2026-07-06T18:00:00Z", "Europe/London", "2026-07-05T23:00:00.000Z"],
    ["2026-03-08T18:00:00Z", "America/New_York", "2026-03-08T05:00:00.000Z"],
    ["2026-11-01T18:00:00Z", "America/New_York", "2026-11-01T04:00:00.000Z"],
    ["2026-10-06T03:00:00Z", "Asia/Kathmandu", "2026-10-05T18:15:00.000Z"],
    ["2026-10-06T18:00:00Z", "Pacific/Auckland", "2026-10-06T11:00:00.000Z"],
    ["2018-11-04T12:00:00Z", "America/Sao_Paulo", "2018-11-04T03:00:00.000Z"],
  ])("%s in %s starts at %s", (now, tz, expected) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(now));
    const midnight = startOfTodayInTz(tz);
    expect(midnight.toISOString()).toBe(expected);
    expect(toLocalDateKey(midnight, tz)).toBe(toLocalDateKey(new Date(), tz));
  });
});
