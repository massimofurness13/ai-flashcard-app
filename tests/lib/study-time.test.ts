import { describe, it, expect } from "vitest";
import { StudyClock, formatStudyTime } from "@/lib/study-time";
describe("active study timing", () => {
  it("excludes countdown, pauses and time away, without resetting accumulated time", () => {
    let now = 3000;
    const clock = new StudyClock(undefined, () => now);
    expect(clock.read().elapsedMs).toBe(0);
    clock.start(); now += 12000; clock.reviewed();
    expect(clock.stop()).toEqual({ elapsedMs: 12000, timedCards: 1 });
    now += 3600000; clock.stop(); clock.start(); clock.start(); now += 8000;
    expect(clock.reviewed()).toEqual({ elapsedMs: 20000, timedCards: 2 });
    const resumed = new StudyClock(clock.stop(), () => now);
    now += 50000; resumed.start(); now += 10000;
    expect(resumed.stop()).toEqual({ elapsedMs: 30000, timedCards: 2 });
  });
  it("formats a measured 150-card session without estimating duration", () => {
    let now = 0; const clock = new StudyClock(undefined, () => now); clock.start();
    for (let i=0;i<150;i++) { now += 9000; clock.reviewed(); }
    expect(clock.stop()).toEqual({ elapsedMs: 1350000, timedCards: 150 });
    expect(formatStudyTime(clock.read().elapsedMs)).toBe("22 min 30 sec");
  });
});
