import { NextResponse } from "next/server";
import { stripe, planFromPriceId } from "@/lib/stripe";
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

      // Credit-pack purchases (one-time payments)
      if (session.mode === "payment" && session.metadata?.type === "credit_purchase") {
        const userId = session.metadata.userId;
        const bundle = session.metadata.bundle;
        const creditsAmount = parseInt(session.metadata.creditsAmount || "0", 10);
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        if (userId && creditsAmount > 0 && paymentIntentId) {
          // Idempotent via unique stripePaymentIntentId
          const alreadyLogged = await prisma.creditPurchase.findUnique({
            where: { stripePaymentIntentId: paymentIntentId },
          });
          if (!alreadyLogged) {
            await prisma.creditPurchase.create({
              data: {
                userId,
                stripePaymentIntentId: paymentIntentId,
                bundle,
                creditsAdded: creditsAmount,
                amountCents: session.amount_total || 0,
              },
            });
            await prisma.user.update({
              where: { id: userId },
              data: { imageCredits: { increment: creditsAmount } },
            });
          }
        }
        break;
      }

      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const periodEnd = subscription.items.data[0]?.current_period_end;
        const periodEndDate = periodEnd ? new Date(periodEnd * 1000) : null;
        const userId = session.metadata?.userId || "";

        // Plan is derived from the Stripe price ID, not from
        // metadata — the price ID is the only thing the user can't
        // tamper with from the client. If the env price ID matches
        // the yearly product, this is yearly; otherwise monthly.
        const priceId = subscription.items.data[0]?.price.id;
        const plan = planFromPriceId(priceId);

        await prisma.subscription.upsert({
          where: { stripeCustomerId: session.customer as string },
          update: {
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: periodEndDate,
            plan,
          },
          create: {
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: periodEndDate,
            plan,
          },
        });

        // Align quota reset with the Stripe billing cycle and clear
        // any prior usage so the new Pro period starts fresh. For
        // yearly subs, periodEndDate is one year out — getQuotaState
        // sees the yearly plan and grants 6,000 credits against this
        // single window. For monthly, it's the standard 30-day cycle
        // with 500 credits.
        if (userId && periodEndDate) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              monthlyImagesUsed: 0,
              monthlyImagesResetAt: periodEndDate,
            },
          });
        }
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
      const periodEndDate = itemPeriodEnd ? new Date(itemPeriodEnd * 1000) : null;

      const existing = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id },
        select: { userId: true, currentPeriodEnd: true },
      });

      // Plan can change mid-cycle (monthly → yearly upgrade with
      // proration). Re-derive from the current price every time.
      const priceId = subscription.items.data[0]?.price.id;
      const plan = planFromPriceId(priceId);

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: subscription.status,
          currentPeriodEnd: periodEndDate,
          plan,
        },
      });

      // On successful renewal (new periodEnd is later than the previous one),
      // reset the monthly image counter and sync to the new cycle end.
      if (
        existing &&
        periodEndDate &&
        subscription.status === "active" &&
        (!existing.currentPeriodEnd || periodEndDate > existing.currentPeriodEnd)
      ) {
        await prisma.user.update({
          where: { id: existing.userId },
          data: {
            monthlyImagesUsed: 0,
            monthlyImagesResetAt: periodEndDate,
          },
        });
      }
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
