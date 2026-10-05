import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn(), lock: vi.fn(), existing: vi.fn(), card: vi.fn(), latest: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: mock.transaction } }));
import { POST } from "@/app/api/review/route";
const review = { cardId: "card", quality: 4, eventId: "ec37c8dd-c353-4f58-b690-ad61d5b5a229", reviewedAt: new Date().toISOString() };
const request = (body: unknown) => new Request("https://huella.example/api/review", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "owner" });
  mock.lock.mockResolvedValue([{ id: "card" }]);
  mock.existing.mockResolvedValue(null);
  mock.card.mockResolvedValue({ id: "card", easeFactor: 2.5, interval: 0, repetitions: 0 });
  mock.latest.mockResolvedValue(null);
  mock.transaction.mockImplementation(fn => fn({ $queryRaw: mock.lock, card: { findUniqueOrThrow: mock.card, update: mock.update }, reviewLog: { findUnique: mock.existing, findFirst: mock.latest, create: mock.create } }));
});
describe("review sync API", () => {
  it("writes the log and schedule inside one transaction", async () => {
    expect((await POST(request(review))).status).toBe(200);
    expect(mock.update).toHaveBeenCalledTimes(1);
    expect(mock.create.mock.calls[0][0].data.reviewedAt).toEqual(new Date(review.reviewedAt));
  });
  it("acknowledges a retry without rescheduling or recounting", async () => {
    mock.existing.mockResolvedValue({ cardId: "card", quality: 4 });
    expect(await (await POST(request(review))).json()).toMatchObject({ duplicate: true });
    expect(mock.update).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled();
  });
  it("rejects access to another owner's card", async () => {
    mock.lock.mockResolvedValue([]);
    expect((await POST(request(review))).status).toBe(404);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("rejects reusing an event ID with different content", async () => {
    mock.existing.mockResolvedValue({ cardId: "card", quality: 1 });
    expect((await POST(request(review))).status).toBe(409);
  });
  it("records passive views without changing the schedule", async () => {
    await POST(request({ ...review, quality: 0 }));
    expect(mock.update).not.toHaveBeenCalled(); expect(mock.create).toHaveBeenCalledTimes(1);
  });
  it("does not rewind a newer review's schedule", async () => {
    mock.latest.mockResolvedValue({ reviewedAt: new Date(Date.now() + 1000) });
    await POST(request(review));
    expect(mock.update).not.toHaveBeenCalled(); expect(mock.create).toHaveBeenCalledTimes(1);
  });
  it.each([-1, 6, 1.5, "4"])("rejects invalid rating %s", async quality => {
    expect((await POST(request({ ...review, quality }))).status).toBe(400);
  });
});
