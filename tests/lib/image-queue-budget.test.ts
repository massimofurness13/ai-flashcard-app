import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), quota: vi.fn(), worker: vi.fn(),
  deck: { findUnique: vi.fn() },
  card: { findMany: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: { deck: mocks.deck, card: mocks.card } }));
vi.mock("@/lib/auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/image-quota", () => ({
  getQuotaState: mocks.quota, TIER_COSTS: { quick: 1, premium: 5 },
}));
vi.mock("@/app/api/cron/process-image-queue/route", () => ({ processQueue: mocks.worker }));
import { POST } from "../../src/app/api/images/generate-deck-background/route";

const request = (body: object) => new Request("https://example.com/api/images/generate-deck-background", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.deck.findUnique.mockResolvedValue({ id: "pack" });
  mocks.card.findMany.mockResolvedValue(Array.from({ length: 17 }, (_, i) => ({ id: `card-${i}` })));
  mocks.card.update.mockResolvedValue({});
  mocks.quota.mockResolvedValue({ totalRemaining: 1000 });
  mocks.worker.mockResolvedValue({});
});

describe("explicit image generation budget", () => {
  it("queues only the requested remainder even with ample purchased credits", async () => {
    const response = await POST(request({ deckId: "pack", maxImages: 3, premiumCount: 1 }));
    expect(response.status).toBe(200);
    expect((await response.json()).queued).toBe(3);
    expect(mocks.card.update).toHaveBeenCalledTimes(3);
    expect(mocks.card.update.mock.calls.map(([arg]) => arg.data.imageTier)).toEqual(["premium", "quick", "quick"]);
  });

  it("also respects available credits", async () => {
    mocks.quota.mockResolvedValue({ totalRemaining: 6 });
    const response = await POST(request({ deckId: "pack", maxImages: 10, premiumCount: 1 }));
    expect((await response.json()).queued).toBe(2);
  });

  it.each([0, -1, 1.5, 501, "3"])("rejects invalid requested limits: %s", async (maxImages) => {
    expect((await POST(request({ deckId: "pack", maxImages }))).status).toBe(400);
    expect(mocks.card.update).not.toHaveBeenCalled();
  });

  it("does not queue images in another user's pack", async () => {
    mocks.deck.findUnique.mockResolvedValue(null);
    expect((await POST(request({ deckId: "someone-elses-pack", maxImages: 3 }))).status).toBe(404);
    expect(mocks.deck.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "someone-elses-pack", userId: "owner" },
    }));
    expect(mocks.card.update).not.toHaveBeenCalled();
  });
});
