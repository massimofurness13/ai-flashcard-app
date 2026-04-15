import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { origin } = new URL(request.url);

  const subscription = await prisma.subscription.findUnique({
    where: { userId: auth.userId },
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 404 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${origin}/account`,
  });

  return NextResponse.json({ url: session.url });
}
