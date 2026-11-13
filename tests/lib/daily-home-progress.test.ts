import { describe, it, expect, vi, beforeEach } from "vitest";
import { dailyStudyStatus, type DailyPick } from "../../src/lib/daily-study";
const mocks = vi.hoisted(() => ({ cards: vi.fn(), logs: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { card: { findMany: mocks.cards }, reviewLog: { findMany: mocks.logs } } }));
import { readDailyPlanProgress } from "../../src/lib/daily-plan-progress";
const now = new Date("2026-11-12T18:00:00Z");
const summary = { day: "2026-11-12", timeZone: "America/Bogota", completed: 129, total: 150 };

describe("Home daily-set progress", () => {
  it("shows remaining and finished for the actual set", () => {
    expect(dailyStudyStatus(summary, now)).toEqual({ total: 150, completed: 129, remaining: 21, finished: false });
    expect(dailyStudyStatus({ ...summary, completed: 150 }, now).finished).toBe(true);
    expect(dailyStudyStatus({ ...summary, completed: 83, total: 83 }, now).finished).toBe(true);
  });
  it("does not show yesterday's cached completion after local midnight", () => {
    const finished = { ...summary, completed: 150 };
    expect(dailyStudyStatus(finished, new Date("2026-11-13T04:59:00Z")).finished).toBe(true);
    expect(dailyStudyStatus(finished, new Date("2026-11-13T05:00:00Z")).remaining).toBe(100);
  });
  it("does not claim an empty or not-yet-created set is finished", () => {
    expect(dailyStudyStatus(null, now).finished).toBe(false);
    expect(dailyStudyStatus({ ...summary, total: 0, completed: 0 }, now).finished).toBe(false);
  });
});

describe("shared persisted-set reader", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("only counts the selected face, excluding archived/deleted cards and duplicate ratings", async () => {
    const picks = ["a", "b", "archived"].map(id => ({ id, studyDirection: "front", group: "practice", studyReason: "" })) as DailyPick[];
    mocks.cards.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    mocks.logs.mockResolvedValue([
      { cardId: "a", direction: "front", quality: 4 },
      { cardId: "a", direction: "front", quality: 1 },
      { cardId: "b", direction: "back", quality: 4 },
      { cardId: "b", direction: "front", quality: 0 },
      { cardId: "unrelated", direction: "front", quality: 4 },
    ]);
    const result = await readDailyPlanProgress("user", { picks, createdAt: now });
    expect(result.total).toBe(2);
    expect(result.completed).toBe(1);
    expect(result.remaining.map(p => p.id)).toEqual(["b"]);
    expect(mocks.cards.mock.calls[0][0].where.deck).toEqual({ userId: "user", archivedAt: null });
    expect(mocks.logs.mock.calls[0][0].where).toMatchObject({ card: { deck: { userId: "user" } }, reviewedAt: { gte: now }, quality: { gt: 0 } });
  });
  it("never fetches reviews or creates a plan when there is no daily set", async () => {
    expect((await readDailyPlanProgress("user", null)).total).toBe(0);
    expect(mocks.cards).not.toHaveBeenCalled();
    expect(mocks.logs).not.toHaveBeenCalled();
  });
});
