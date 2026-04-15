import { describe, it, expect } from "vitest";
import { sm2, defaultSM2State, masteryLevel } from "../../src/lib/sm2";

describe("SM-2 Algorithm", () => {
  it("first successful review gives interval of 1", () => {
    const result = sm2(5, defaultSM2State());
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it("second successful review gives interval of 6", () => {
    const state = { easeFactor: 2.5, interval: 1, repetitions: 1 };
    const result = sm2(5, state);
    expect(result.interval).toBe(6);
    expect(result.repetitions).toBe(2);
  });

  it("third successful review multiplies by ease factor", () => {
    const state = { easeFactor: 2.5, interval: 6, repetitions: 2 };
    const result = sm2(5, state);
    expect(result.interval).toBe(15); // 6 * 2.6 (EF increases) ≈ 15
    expect(result.repetitions).toBe(3);
  });

  it("quality 5 increases ease factor", () => {
    const state = defaultSM2State();
    const result = sm2(5, state);
    expect(result.easeFactor).toBeGreaterThan(2.5);
  });

  it("quality 1 (Again) resets to interval 1 and repetitions 0", () => {
    const state = { easeFactor: 2.5, interval: 15, repetitions: 4 };
    const result = sm2(1, state);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
  });

  it("quality 3 (Good) is successful but doesn't increase EF much", () => {
    const state = defaultSM2State();
    const result = sm2(3, state);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    // EF should decrease slightly for quality 3
    expect(result.easeFactor).toBeLessThan(2.5);
  });

  it("ease factor never drops below 1.3", () => {
    let state = defaultSM2State();
    // Repeatedly answer quality 1 to drive EF down
    for (let i = 0; i < 20; i++) {
      const result = sm2(1, state);
      state = { easeFactor: result.easeFactor, interval: result.interval, repetitions: result.repetitions };
    }
    expect(state.easeFactor).toBe(1.3);
  });

  it("interval grows exponentially with quality 5", () => {
    let state = defaultSM2State();
    const intervals: number[] = [];

    for (let i = 0; i < 6; i++) {
      const result = sm2(5, state);
      intervals.push(result.interval);
      state = { easeFactor: result.easeFactor, interval: result.interval, repetitions: result.repetitions };
    }

    // Each interval should be larger than the last after the initial 1, 6
    for (let i = 2; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    }
  });

  it("returns a nextReviewAt date in the future", () => {
    const result = sm2(5, defaultSM2State());
    expect(result.nextReviewAt).toBeInstanceOf(Date);
    expect(result.nextReviewAt.getTime()).toBeGreaterThan(Date.now() - 86400000); // at least today
  });
});

describe("masteryLevel", () => {
  it("returns 0 for no repetitions", () => {
    expect(masteryLevel({ easeFactor: 2.5, interval: 0, repetitions: 0 })).toBe(0);
  });

  it("returns 20 for 1 repetition", () => {
    expect(masteryLevel({ easeFactor: 2.5, interval: 1, repetitions: 1 })).toBe(20);
  });

  it("returns 40 for 2 repetitions", () => {
    expect(masteryLevel({ easeFactor: 2.5, interval: 6, repetitions: 2 })).toBe(40);
  });

  it("returns higher for more repetitions and higher EF", () => {
    const high = masteryLevel({ easeFactor: 2.5, interval: 30, repetitions: 8 });
    const low = masteryLevel({ easeFactor: 1.3, interval: 3, repetitions: 3 });
    expect(high).toBeGreaterThan(low);
  });

  it("returns 100 for highly mastered card", () => {
    const level = masteryLevel({ easeFactor: 2.5, interval: 60, repetitions: 8 });
    expect(level).toBe(100);
  });
});
