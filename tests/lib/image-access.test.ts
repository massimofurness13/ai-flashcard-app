import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/credit-ledger", () => ({ recordLedger: vi.fn() }));

import { canViewAiImages } from "../../src/lib/subscription";
import { getQuotaState } from "../../src/lib/image-quota";

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue({
    id: "user-1", email: "test@example.com",
    createdAt: new Date("2020-01-01"), imageCredits: 37,
    monthlyImagesUsed: 0, monthlyImagesResetAt: null,
    lifetimeFreeImagesUsed: 25,
  });
  db.subscription.findUnique.mockResolvedValue(null);
});

describe("retained image access", () => {
  it("keeps images visible for an old free account in pack and study responses", async () => {
    expect(await canViewAiImages("user-1")).toBe(true);
    const quota = await getQuotaState("user-1");
    expect(quota.canViewAiImages).toBe(true);
    expect(quota.freeViewTrialEndsAt).toBeNull();
    expect(quota.credits).toBe(37);
    expect(quota.monthlyLimit).toBe(0);
  });

  it("cancellation keeps images and purchased credits without renewing the allowance", async () => {
    db.subscription.findUnique.mockResolvedValue({
      status: "canceled", plan: "yearly",
      currentPeriodEnd: new Date("2021-01-01"),
    });
    expect(await canViewAiImages("user-1")).toBe(true);
    const quota = await getQuotaState("user-1");
    expect(quota.isPro).toBe(false);
    expect(quota.canViewAiImages).toBe(true);
    expect(quota.totalRemaining).toBe(37);
  });

  it("preserves existing active subscribers' included credits", async () => {
    db.subscription.findUnique.mockResolvedValue({
      status: "active", plan: "yearly",
      currentPeriodEnd: new Date("2099-01-01"),
    });
    const quota = await getQuotaState("user-1");
    expect(quota.isPro).toBe(true);
    expect(quota.monthlyLimit).toBe(6000);
    expect(quota.canViewAiImages).toBe(true);
  });

  it("does not grant viewing access for a missing account", async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect(await canViewAiImages("missing")).toBe(false);
    expect((await getQuotaState("missing")).canViewAiImages).toBe(false);
  });
});
