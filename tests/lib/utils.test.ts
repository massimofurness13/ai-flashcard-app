import { describe, it, expect } from "vitest";
import { estimateImageGenTime, formatRelativeDate } from "../../src/lib/utils";

describe("estimateImageGenTime", () => {
  it("returns 'a moment' for 0 or negative", () => {
    expect(estimateImageGenTime(0)).toBe("a moment");
    expect(estimateImageGenTime(-5)).toBe("a moment");
  });

  it("returns 'under a minute' for 1-4 cards", () => {
    expect(estimateImageGenTime(1)).toBe("under a minute");
    expect(estimateImageGenTime(4)).toBe("under a minute");
  });

  it("returns 'about a minute' for 5-8 cards", () => {
    expect(estimateImageGenTime(5)).toBe("about a minute");
    expect(estimateImageGenTime(8)).toBe("about a minute");
  });

  it("returns 'about N minutes' for 9+ cards", () => {
    expect(estimateImageGenTime(9)).toBe("about 2 minutes");
    expect(estimateImageGenTime(12)).toBe("about 2 minutes");
    expect(estimateImageGenTime(30)).toBe("about 5 minutes");
    expect(estimateImageGenTime(60)).toBe("about 10 minutes");
  });
});

describe("formatRelativeDate", () => {
  it("returns 'Today' for today", () => {
    expect(formatRelativeDate(new Date())).toBe("Today");
  });

  it("returns 'Tomorrow' for next day", () => {
    const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000);
    expect(formatRelativeDate(tomorrow)).toBe("Tomorrow");
  });

  it("returns 'Yesterday' for previous day", () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(formatRelativeDate(yesterday)).toBe("Yesterday");
  });

  it("handles far future", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(formatRelativeDate(future)).toBe("In 7 days");
  });

  it("handles far past", () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(formatRelativeDate(past)).toBe("10 days ago");
  });
});
