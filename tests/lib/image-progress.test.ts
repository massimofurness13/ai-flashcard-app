import { describe, expect, it } from "vitest";
import { IMAGE_PROGRESS_IDLE_MS, progressExpiry } from "@/lib/image-progress";

describe("large image batch progress", () => {
  it("keeps a 252-card job active beyond ten minutes while images arrive", () => {
    let expires = IMAGE_PROGRESS_IDLE_MS;
    for (let minute = 1; minute <= 17; minute++) {
      const now = minute * 60_000;
      expires = progressExpiry(252 - (minute - 1) * 10, 252 - minute * 10, expires, now);
      expect(expires).toBeGreaterThan(now);
    }
  });
  it("does not extend a stalled job merely because polling continues", () => {
    expect(progressExpiry(154, 154, 600_000, 900_000)).toBe(600_000);
    expect(progressExpiry(154, 155, 600_000, 900_000)).toBe(600_000);
  });
  it("does not renew a completed job", () => {
    expect(progressExpiry(1, 0, 600_000, 900_000)).toBe(600_000);
  });
});
