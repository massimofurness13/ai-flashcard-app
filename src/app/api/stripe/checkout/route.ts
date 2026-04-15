import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { stripe, PRICE_ID } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { origin } = new URL(request.url);

  // Check if user already has a Stripe customer ID
  let subscription = await prisma.subscription.findUnique({
    where: { userId: auth.userId },
  });

  let customerId = subscription?.stripeCustomerId;

  if (!customerId) {
    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true },
    });

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: user?.email,
      metadata: { userId: auth.userId },
    });

    customerId = customer.id;

    // Save customer ID
    await prisma.subscription.upsert({
      where: { userId: auth.userId },
      update: { stripeCustomerId: customerId },
      create: {
        userId: auth.userId,
        stripeCustomerId: customerId,
        status: "inactive",
      },
    });
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: `${origin}/account?success=true`,
    cancel_url: `${origin}/pricing?canceled=true`,
    metadata: { userId: auth.userId },
  });

  return NextResponse.json({ url: session.url });
}
