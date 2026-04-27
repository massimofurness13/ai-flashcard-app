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

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true },
    });
    const customerId = await resolveLiveCustomerId(auth.userId, user?.email);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/account?success=true&plan=${plan}`,
      cancel_url: `${origin}/pricing?canceled=true`,
      metadata: { userId: auth.userId, plan },
      // For users already on monthly upgrading to yearly: prorate the
      // unused portion of the current month so they don't pay twice.
      subscription_data: {
        metadata: { userId: auth.userId, plan },
      },
    });

    return NextResponse.json({ url: session.url, plan });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Stripe checkout failed.";
    console.error("[stripe/checkout] failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
