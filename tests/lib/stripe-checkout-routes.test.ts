import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  auth: vi.fn(), customer: vi.fn(), user: vi.fn(), subscription: vi.fn(), checkout: vi.fn(), portal: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/lib/stripe", () => ({
  PRICE_ID: "price_monthly_fixture", PRICE_ID_YEARLY: "price_yearly_fixture",
  resolveLiveCustomerId: mock.customer,
  stripe: { checkout: { sessions: { create: mock.checkout } }, billingPortal: { sessions: { create: mock.portal } } },
}));
vi.mock("@/lib/db", () => ({ prisma: {
  user: { findUnique: mock.user }, subscription: { findUnique: mock.subscription },
} }));
vi.mock("@/lib/public-origin", () => ({ getPublicOrigin: () => "https://huella.test" }));
import { POST as subscribe } from "@/app/api/stripe/checkout/route";
import { POST as credits } from "@/app/api/stripe/credits/route";

const request = (body: unknown) => new Request("https://huella.test/api/stripe/checkout", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "user_test" });
  mock.user.mockResolvedValue({ email: "test@example.com" });
  mock.subscription.mockResolvedValue(null);
  mock.customer.mockResolvedValue("cus_fixture");
  mock.checkout.mockResolvedValue({ url: "https://checkout.stripe.com/fixture" });
  mock.portal.mockResolvedValue({ url: "https://billing.stripe.com/fixture" });
  vi.stubEnv("STRIPE_PRICE_ID_CREDITS_500", "price_500_fixture");
});

describe("checkout boundaries (no real Stripe calls)", () => {
  it.each([null, [], { plan: "free" }, { plan: 1 }])("rejects invalid subscription input %j", async body => {
    expect((await subscribe(request(body))).status).toBe(400);
    expect(mock.checkout).not.toHaveBeenCalled();
  });
  it.each(["monthly", "yearly"])("uses the configured %s price", async plan => {
    expect((await subscribe(request({ plan }))).status).toBe(200);
    expect(mock.checkout.mock.calls[0][0].line_items).toEqual([{ price: `price_${plan}_fixture`, quantity: 1 }]);
  });
  it.each(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"])("sends existing %s subscribers to manage billing instead of buying a second subscription", async status => {
    mock.subscription.mockResolvedValue({ status, stripeSubscriptionId: "sub_existing", stripeCustomerId: "cus_existing" });
    const response = await subscribe(request({ plan: "yearly" }));
    expect((await response.json()).url).toBe("https://billing.stripe.com/fixture");
    expect(mock.checkout).not.toHaveBeenCalled();
    expect(mock.customer).not.toHaveBeenCalled();
  });
  it.each([null, {}, [], { bundle: "__proto__" }, { bundle: "toString" }, { bundle: 500 }, { bundle: ["500"] }])("rejects invalid credit bundle %j before contacting Stripe", async body => {
    expect((await credits(request(body))).status).toBe(400);
    expect(mock.checkout).not.toHaveBeenCalled();
  });
  it("uses the configured top-up price and server-owned credit amount", async () => {
    expect((await credits(request({ bundle: "500", creditsAmount: "999999" }))).status).toBe(200);
    expect(mock.checkout.mock.calls[0][0].metadata.creditsAmount).toBe("500");
    expect(mock.checkout.mock.calls[0][0].line_items[0].price).toBe("price_500_fixture");
  });
  it.each([subscribe, credits])("rejects malformed JSON", async handler => {
    const response = await handler(new Request("https://huella.test/api/stripe/checkout", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(mock.checkout).not.toHaveBeenCalled();
  });
});
