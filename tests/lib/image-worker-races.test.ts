import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  card: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  deck: { findUnique: vi.fn() },
  consume: vi.fn(), refund: vi.fn(), generate: vi.fn(), auth: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { card: mocks.card, deck: mocks.deck } }));
vi.mock("@/lib/image-quota", () => ({ consumeImageCredit: mocks.consume, refundImageCredit: mocks.refund }));
vi.mock("@/lib/image-gen", () => ({ generateAndUploadImage: mocks.generate }));
vi.mock("@/lib/auth", () => ({ requireAuth: mocks.auth }));
import { processQueue } from "../../src/app/api/cron/process-image-queue/route";
import { POST as stop } from "../../src/app/api/decks/[deckId]/stop-image-generation/route";

const candidate = {
  id: "card", front: "hola", back: "hello", imageTier: "premium",
  updatedAt: new Date("2026-01-01"), deckId: "deck",
  deck: { userId: "owner", name: "Spanish" },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.card.findMany.mockResolvedValue([candidate]);
  mocks.card.updateMany.mockResolvedValue({ count: 1 });
  mocks.card.count.mockResolvedValue(0);
  mocks.consume.mockResolvedValue({ ok: true, source: "credits", amountUsed: 5 });
  mocks.generate.mockResolvedValue("https://example.com/generated.png");
  mocks.refund.mockResolvedValue(undefined);
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.deck.findUnique.mockResolvedValue({ id: "deck" });
});

describe("image worker ownership and cancellation", () => {
  it("does not spend if the candidate was cancelled or changed before claim", async () => {
    mocks.card.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await processQueue();
    expect(result.processed).toBe(0);
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.card.updateMany.mock.calls[0][0].where).toMatchObject({
      id: "card", imageTier: "premium", updatedAt: candidate.updatedAt,
    });
  });

  it("only the winning worker spends and generates when claims overlap", async () => {
    mocks.card.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await Promise.all([processQueue(), processQueue()]);
    expect(mocks.consume).toHaveBeenCalledTimes(1);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it("saves only under its own lease", async () => {
    expect((await processQueue()).succeeded).toBe(1);
    const lease = mocks.card.updateMany.mock.calls[0][0].data.imageGenLockedAt;
    expect(mocks.card.updateMany.mock.calls[1][0].where).toEqual({
      id: "card", imageUrl: null, imageGenLockedAt: lease,
    });
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("refunds an undelivered result without clearing a newer worker's lock", async () => {
    mocks.card.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect((await processQueue()).succeeded).toBe(0);
    expect(mocks.refund).toHaveBeenCalledTimes(1);
    const lease = mocks.card.updateMany.mock.calls[0][0].data.imageGenLockedAt;
    expect(mocks.card.updateMany.mock.calls[2][0].where).toEqual({ id: "card", imageGenLockedAt: lease });
  });

  it("does not issue a second refund when cleanup fails after a refund", async () => {
    mocks.card.updateMany.mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 }).mockRejectedValueOnce(new Error("database unavailable"));
    await expect(processQueue()).rejects.toThrow("database unavailable");
    expect(mocks.refund).toHaveBeenCalledTimes(1);
  });

  it("stop withdraws pending intent without unlocking paid work already running", async () => {
    const response = await stop(new Request("https://example.com/stop", { method: "POST" }), {
      params: Promise.resolve({ deckId: "deck" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.card.updateMany.mock.calls[0][0].data).toEqual({
      imageTier: null, imageGenError: null,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
