import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    user: { updateMany: vi.fn(), update: vi.fn() },
    subscription: { findUnique: vi.fn() },
    creditLedger: { create: vi.fn() },
  },
  transaction: vi.fn(),
  isPro: vi.fn(),
  outsideUser: { update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  outsideLedger: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    user: mocks.outsideUser,
    creditLedger: mocks.outsideLedger,
  },
}));
vi.mock("@/lib/subscription", () => ({ isProUser: mocks.isPro }));
import {
  consumeImageCredit,
  refundImageCredit,
  addCredits,
} from "../../src/lib/image-quota";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));
  mocks.isPro.mockResolvedValue(false);
  mocks.tx.user.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.user.update.mockResolvedValue({});
  mocks.tx.subscription.findUnique.mockResolvedValue({ plan: "monthly" });
  mocks.tx.creditLedger.create.mockResolvedValue({ id: "entry" });
});

describe("balance and ledger transaction boundaries", () => {
  it("writes purchased-credit debit and its audit record through the same transaction", async () => {
    expect(
      await consumeImageCredit("user", "premium", { deckId: "pack" }),
    ).toEqual({
      ok: true,
      source: "credits",
      amountUsed: 5,
    });
    expect(mocks.tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user", imageCredits: { gte: 5 } },
      data: { imageCredits: { decrement: 5 } },
    });
    expect(mocks.tx.creditLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user",
        delta: -5,
        kind: "spend",
        source: "credits",
        tier: "premium",
        deckId: "pack",
      }),
    });
    expect(mocks.outsideUser.updateMany).not.toHaveBeenCalled();
    expect(mocks.outsideLedger.create).not.toHaveBeenCalled();
  });

  it("records a free-credit debit after purchased credits are exhausted", async () => {
    mocks.tx.user.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await consumeImageCredit("user")).toMatchObject({
      ok: true,
      source: "free",
    });
    expect(mocks.tx.creditLedger.create).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1, 2])(
    "keeps allowance spend path %i within the transaction",
    async (unsuccessfulPaths) => {
      mocks.isPro.mockResolvedValue(true);
      for (let i = 0; i < unsuccessfulPaths; i++)
        mocks.tx.user.updateMany.mockResolvedValueOnce({ count: 0 });
      expect(await consumeImageCredit("user", "premium")).toMatchObject({
        ok: true,
        source: "monthly",
      });
      expect(mocks.tx.creditLedger.create).toHaveBeenCalledTimes(1);
      expect(mocks.tx.creditLedger.create.mock.calls[0][0].data.delta).toBe(-5);
    },
  );

  it("propagates a history failure out of the debit transaction so Prisma rolls it back", async () => {
    mocks.tx.creditLedger.create.mockRejectedValue(
      new Error("ledger unavailable"),
    );
    await expect(consumeImageCredit("user", "premium")).rejects.toThrow(
      "ledger unavailable",
    );
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.outsideLedger.create).not.toHaveBeenCalled();
  });

  it.each(["monthly", "credits", "free"] as const)(
    "refunds %s inside one transaction",
    async (source) => {
      await refundImageCredit("user", source, 5);
      expect(mocks.tx.user.update).toHaveBeenCalledTimes(1);
      expect(mocks.tx.creditLedger.create.mock.calls[0][0].data).toMatchObject({
        delta: 5,
        kind: "refund",
        source,
      });
      expect(mocks.outsideUser.update).not.toHaveBeenCalled();
    },
  );

  it("propagates a history failure from refunds", async () => {
    mocks.tx.creditLedger.create.mockRejectedValue(
      new Error("ledger unavailable"),
    );
    await expect(refundImageCredit("user", "credits", 5)).rejects.toThrow(
      "ledger unavailable",
    );
  });

  it("records a grant within the balance transaction", async () => {
    await addCredits("user", 20, "Support adjustment");
    expect(mocks.tx.creditLedger.create.mock.calls[0][0].data).toMatchObject({
      delta: 20,
      kind: "grant",
    });
    expect(mocks.outsideUser.update).not.toHaveBeenCalled();
  });

  it.each([0, -1, 0.5, NaN, Infinity])(
    "rejects invalid refund/grant amount %s before writing",
    async (amount) => {
      await expect(addCredits("user", amount)).rejects.toThrow();
      await expect(
        refundImageCredit("user", "credits", amount),
      ).rejects.toThrow();
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
});
