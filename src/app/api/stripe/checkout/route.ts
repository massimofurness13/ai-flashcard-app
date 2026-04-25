import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  stripe,
  PRICE_ID,
  PRICE_ID_YEARLY,
  type SubscriptionPlan,
} from "@/lib/stripe";
import { prisma } from "@/lib/db";

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
 * open it in an EXTERNAL browser tab (window.open with _blank), so
 * the payment never happens inside a PWA / in-app webview — that
 * sidesteps Apple/Google App Store IAP rules if we ever wrap the app
 * in Capacitor or similar.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let plan: SubscriptionPlan = "monthly";
  try {
    const body = await request.json();
    if (body?.plan === "yearly") plan = "yearly";
  } catch {
    // No body → default monthly
  }

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

  const { origin } = new URL(request.url);

  // Reuse the user's existing Stripe customer if they have one
  const subscription = await prisma.subscription.findUnique({
    where: { userId: auth.userId },
  });

  let customerId = subscription?.stripeCustomerId;

  if (!customerId) {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true },
    });

    const customer = await stripe.customers.create({
      email: user?.email,
      metadata: { userId: auth.userId },
    });

    customerId = customer.id;

    await prisma.subscription.upsert({
      where: { userId: auth.userId },
      update: { stripeCustomerId: customerId },
      create: {
        userId: auth.userId,
        stripeCustomerId: customerId,
        status: "inactive",
        plan,
      },
    });
  }

  // Wrap the Stripe call so we can surface the real error to the
  // client while debugging — Render's logs page hides the message
  // text behind a cookie/query content filter, making it unreadable
  // through browser automation. Once Stripe is wired up cleanly we
  // can revert this to a generic 500.
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/account?success=true&plan=${plan}`,
      cancel_url: `${origin}/pricing?canceled=true`,
      metadata: { userId: auth.userId, plan },
      subscription_data: {
        metadata: { userId: auth.userId, plan },
      },
    });
    return NextResponse.json({ url: session.url, plan });
  } catch (err) {
    const e = err as { message?: string; type?: string; code?: string; raw?: { message?: string } };
    return NextResponse.json(
      {
        error: "stripe_checkout_failed",
        message: e?.message || e?.raw?.message || String(err),
        type: e?.type,
        code: e?.code,
        priceIdUsed: priceId,
        plan,
      },
      { status: 500 }
    );
  }
}
