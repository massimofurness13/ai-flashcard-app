import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

const BUNDLES = {
  "500":  { amount: 500,  priceCents: 499,  label: "500 AI image credits" },
  "1500": { amount: 1500, priceCents: 1199, label: "1500 AI image credits" },
  "5000": { amount: 5000, priceCents: 3499, label: "5000 AI image credits" },
} as const;

type BundleId = keyof typeof BUNDLES;

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { origin } = new URL(request.url);
  const { bundle } = await request.json();

  if (!bundle || !(bundle in BUNDLES)) {
    return NextResponse.json(
      { error: "Invalid bundle. Must be '500', '1500', or '5000'." },
      { status: 400 }
    );
  }

  const pack = BUNDLES[bundle as BundleId];

  // Reuse the user's existing Stripe customer if they have one
  const existing = await prisma.subscription.findUnique({
    where: { userId: auth.userId },
    select: { stripeCustomerId: true },
  });

  let customerId = existing?.stripeCustomerId;

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
      },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: pack.label },
          unit_amount: pack.priceCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/account?credits=added`,
    cancel_url: `${origin}/account?credits=canceled`,
    metadata: {
      userId: auth.userId,
      bundle,
      creditsAmount: String(pack.amount),
      type: "credit_purchase",
    },
  });

  return NextResponse.json({ url: session.url });
}
