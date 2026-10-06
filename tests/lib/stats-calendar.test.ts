import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ reviews: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ userId: "test_user" }) }));
vi.mock("@/lib/db", () => ({ prisma: {
  card: { count: async () => 0 }, deck: { findMany: async () => [] },
  user: { findUnique: mock.user }, reviewLog: { findMany: mock.reviews },
} }));
import { GET } from "@/app/api/stats/route";
let reviews: { reviewedAt: Date; quality: number }[];
const get = (query = "period=7") => GET(new NextRequest(`https://huella.test/api/stats?${query}`));
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-06T18:00:00Z"));
  reviews = ["2026-09-29T12:00:00Z", "2026-09-30T12:00:00Z", "2026-10-05T12:00:00Z"].map(date => ({ reviewedAt: new Date(date), quality: 4 }));
  mock.user.mockResolvedValue({ reminderTimezone: "America/El_Salvador", dailyGoal: 100 });
  mock.reviews.mockImplementation(async ({ where }) => reviews.filter(review => !where.reviewedAt || review.reviewedAt >= where.reviewedAt.gte));
});
afterEach(() => vi.useRealTimers());
describe("statistics calendar boundaries", () => {
  it("counts exactly the same seven local days in the total and chart", async () => {
    const result = await (await get()).json();
    expect(result.dailyCounts).toHaveLength(7);
    expect(result.dailyCounts[0].date).toBe("2026-09-30");
    expect(result.cardsReviewedInPeriod).toBe(2);
    expect(result.dailyCounts.reduce((sum: number, day: { count: number }) => sum + day.count, 0)).toBe(result.cardsReviewedInPeriod);
    expect(result.cardsReviewedToday).toBe(0);
  });
  it("does not include yesterday in today's goal for El Salvador", async () => {
    reviews = ["2026-10-06T05:59:59Z", "2026-10-06T06:00:00Z"].map(date => ({ reviewedAt: new Date(date), quality: 4 }));
    const result = await (await get()).json();
    expect(result.cardsReviewedToday).toBe(1);
    expect(result.dailyCounts.at(-1).count).toBe(1);
  });
  it("does not cap a current streak at the selected chart period", async () => {
    reviews = Array.from({ length: 12 }, (_, index) => ({ reviewedAt: new Date(Date.parse("2026-10-06T12:00:00Z") - index * 86400000), quality: 4 }));
    const result = await (await get()).json();
    expect(result.streak).toBe(12);
    expect(result.cardsReviewedInPeriod).toBe(7);
  });
  it("uses the user's month even when the server has crossed into November", async () => {
    vi.setSystemTime(new Date("2026-11-01T03:00:00Z"));
    const result = await (await get()).json();
    expect(result.calendarMonth).toHaveLength(31);
    expect(result.calendarMonth[0].date).toBe("2026-10-01");
    expect(result.calendarMonth.at(-1).date).toBe("2026-10-31");
  });
  it.each(["period=0", "period=366", "period=NaN", "period=-1", "period=7.5", "period=7&tz=invalid"])("rejects invalid calendar query %s", async query => {
    expect((await get(query)).status).toBe(400);
  });
});
