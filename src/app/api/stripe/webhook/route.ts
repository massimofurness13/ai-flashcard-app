import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        // In Stripe v22+, current_period_end moved to subscription items
        const periodEnd = subscription.items.data[0]?.current_period_end;
        await prisma.subscription.upsert({
          where: {
            stripeCustomerId: session.customer as string,
          },
          update: {
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: periodEnd
              ? new Date(periodEnd * 1000)
              : null,
          },
          create: {
            userId: session.metadata?.userId || "",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: periodEnd
              ? new Date(periodEnd * 1000)
              : null,
          },
        });
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: subscription.status,
          currentPeriodEnd: itemPeriodEnd
            ? new Date(itemPeriodEnd * 1000)
            : null,
        },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // In Stripe v22+, subscription is under parent.subscription_details
      const subId =
        invoice.parent?.subscription_details?.subscription;
      if (subId) {
        const subscriptionId =
          typeof subId === "string" ? subId : subId.id;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: "past_due" },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
