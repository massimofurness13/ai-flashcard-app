import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  retrieve: vi.fn(), create: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(),
}));
vi.mock("stripe", () => ({ default: class {
  customers = { retrieve: mock.retrieve, create: mock.create };
} }));
vi.mock("@/lib/db", () => ({ prisma: { subscription: { findUnique: mock.findUnique, upsert: mock.upsert } } }));
import { resolveLiveCustomerId } from "@/lib/stripe";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture_not_a_real_key");
  mock.findUnique.mockResolvedValue({ stripeCustomerId: "cus_existing" });
  mock.create.mockResolvedValue({ id: "cus_new" });
});

describe("billing customer recovery", () => {
  it("reuses an existing customer", async () => {
    mock.retrieve.mockResolvedValue({ id: "cus_existing" });
    expect(await resolveLiveCustomerId("user_test", "test@example.com")).toBe("cus_existing");
    expect(mock.create).not.toHaveBeenCalled();
  });
  it.each([{ statusCode: 429 }, { statusCode: 500 }, { type: "StripeConnectionError" }, { statusCode: 401 }])("does not replace a customer's billing identity on transient/auth error %j", async error => {
    mock.retrieve.mockRejectedValue(error);
    await expect(resolveLiveCustomerId("user_test", "test@example.com")).rejects.toBe(error);
    expect(mock.create).not.toHaveBeenCalled();
    expect(mock.upsert).not.toHaveBeenCalled();
  });
  it.each([{ deleted: true }, { statusCode: 404, code: "resource_missing" }])("recovers only a genuinely deleted/missing customer %j", async result => {
    if ("deleted" in result) mock.retrieve.mockResolvedValue(result);
    else mock.retrieve.mockRejectedValue(result);
    expect(await resolveLiveCustomerId("user_test", "test@example.com")).toBe("cus_new");
    expect(mock.upsert).toHaveBeenCalledOnce();
  });
});
