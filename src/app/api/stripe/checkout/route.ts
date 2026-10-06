import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  stripe,
  PRICE_ID,
  PRICE_ID_YEARLY,
  resolveLiveCustomerId,
  type SubscriptionPlan,
} from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { getPublicOrigin } from "@/lib/public-origin";
import { z } from "zod";

const checkoutInput = z.object({ plan: z.enum(["monthly", "yearly"]).default("monthly") });

/**
 * Create a Stripe Checkout session for a Pro subscription. Body:
 *   { plan?: "monthly" | "yearly" }   defaults to "monthly"
 *
 * Yearly grants all 6,000 credits upfront; monthly grants 500 per
 * cycle. Both are subscriptions in Stripe — the only difference is
 * which price ID is used. The webhook reads the price ID back to
 * decide which `plan` to write on the Subscription row.
 *
 * The returned `url` is Stripe's hosted Checkout. The client should
 * open it using the shared checkout helper. Native-store eligibility
 * must be reviewed separately; an external browser is not an IAP exemption.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const input = checkoutInput.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: "Choose a monthly or yearly plan." }, { status: 400 });
  }
  const plan: SubscriptionPlan = input.data.plan;

  const priceId = plan === "yearly" ? PRICE_ID_YEARLY : PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      {
        error:
          plan === "yearly"
            ? "Yearly plan not configured. STRIPE_PRICE_ID_YEARLY is missing."
            : "Monthly plan not configured. STRIPE_PRICE_ID is missing.",
      },
      { status: 500 }
    );
  }

  const origin = getPublicOrigin(request);

  try {
    const existing = await prisma.subscription.findUnique({ where: { userId: auth.userId } });
    // Changing a live plan is a billing-portal operation, not a second
    // subscription checkout. Past-due/incomplete subscriptions need recovery,
    // not another charge. Canceled/expired subscriptions may subscribe again.
    if (existing?.stripeSubscriptionId && !["canceled", "incomplete_expired", "inactive"].includes(existing.status)) {
      if (!existing.stripeCustomerId) {
        return NextResponse.json({ error: "Your existing subscription needs billing support before another checkout can start." }, { status: 409 });
      }
      const portal = await stripe.billingPortal.sessions.create({
        customer: existing.stripeCustomerId,
        return_url: `${origin}/account/billing`,
      });
      return NextResponse.json({ url: portal.url, plan, manageExisting: true });
    }
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true },
    });
    const customerId = await resolveLiveCustomerId(auth.userId, user?.email);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/checkout/done?plan=${plan}`,
      cancel_url: `${origin}/checkout/cancelled`,
      metadata: { userId: auth.userId, plan },
      subscription_data: {
        metadata: { userId: auth.userId, plan },
      },
    });

    return NextResponse.json({ url: session.url, plan });
  } catch (err) {
    const raw =
      err instanceof Error ? err.message : "Stripe checkout failed.";
    console.error("[stripe/checkout] failed:", err);

    // Translate common Stripe misconfiguration errors to a message
    // the dev or end user can actually act on. The raw Stripe error
    // "No such price: 'price_…'" looks scary in an alert dialog but
    // almost always means one of two things: (1) the API key is in
    // test mode but the price was created in live mode (or vice
    // versa), or (2) the env var on Render points at a price from
    // a different Stripe account. Surface both possibilities.
    if (/No such price/i.test(raw)) {
      return NextResponse.json(
        {
          error:
            "Checkout couldn't start — the Stripe price ID configured for this plan doesn't exist in your Stripe account. This usually means the STRIPE_SECRET_KEY mode (test vs live) doesn't match the mode the price was created in. Open the Stripe Dashboard, switch to the matching mode, and copy the correct price ID into STRIPE_PRICE_ID (or STRIPE_PRICE_ID_YEARLY) on Render.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: raw }, { status: 500 });
  }
}
