import { NextResponse } from "next/server";
import { stripe, planFromPriceId } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { recordLedger } from "@/lib/credit-ledger";
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

        // Reject (with 500) if any required field is missing — Stripe
        // will retry, and we get to fix our metadata bug before money
        // is silently attached to an empty userId.
        if (!userId || creditsAmount <= 0 || !paymentIntentId) {
          console.error(
            `[stripe/webhook] credit_purchase missing fields ` +
              `(userId=${!!userId}, credits=${creditsAmount}, pi=${!!paymentIntentId})`,
          );
          return NextResponse.json(
            { error: "credit_purchase missing required metadata" },
            { status: 500 },
          );
        }

        // Atomic idempotency: do create + increment in one transaction,
        // and let the unique constraint on stripePaymentIntentId guard
        // against double-delivery. If the create fails with P2002, the
        // increment never runs — no double-credit possible.
        try {
          await prisma.$transaction(async (tx) => {
            await tx.creditPurchase.create({
              data: {
                userId,
                stripePaymentIntentId: paymentIntentId,
                bundle,
                creditsAdded: creditsAmount,
                amountCents: session.amount_total || 0,
              },
            });
            await tx.user.update({
              where: { id: userId },
              data: { imageCredits: { increment: creditsAmount } },
            });
          });
          // Record the top-up in the credit ledger so it shows on the
          // user's /usage history. Only runs on first delivery — a
          // duplicate (P2002) throws above and skips this.
          await recordLedger({
            userId,
            delta: creditsAmount,
            kind: "purchase",
            source: "credits",
            note: `Top-up — ${bundle} credit bundle`,
          });
        } catch (err: unknown) {
          // P2002 = Prisma unique-constraint violation — we already
          // processed this PI on a prior delivery. Treat as success
          // and return 200 so Stripe stops retrying.
          const code = (err as { code?: string })?.code;
          if (code !== "P2002") {
            console.error(`[stripe/webhook] credit_purchase tx failed:`, err);
            return NextResponse.json(
              { error: "credit_purchase transaction failed" },
              { status: 500 },
            );
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

        // userId lives in BOTH the session metadata (set by the
        // checkout route) and the subscription metadata (copied via
        // subscription_data.metadata). Try both. If neither has it,
        // return 500 so Stripe retries — we'd rather have Stripe yell
        // at us than silently create an orphan Subscription with
        // userId="" that no one can ever access.
        const userId =
          session.metadata?.userId ||
          subscription.metadata?.userId ||
          "";

        if (!userId) {
          console.error(
            `[stripe/webhook] subscription checkout missing userId metadata ` +
              `(session=${session.id}, sub=${subscription.id})`,
          );
          return NextResponse.json(
            { error: "subscription checkout missing userId metadata" },
            { status: 500 },
          );
        }

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

      // Plan can change mid-cycle (monthly → yearly upgrade with
      // proration). Re-derive from the current price every time.
      const priceId = subscription.items.data[0]?.price.id;
      const plan = planFromPriceId(priceId);

      // Just sync subscription state. Credit-reset on renewal is
      // handled by invoice.payment_succeeded (with
      // billing_reason="subscription_cycle") because it's the only
      // event that distinguishes "actual renewal" from "plan change
      // that happens to extend the period." The old logic here
      // (periodEndDate > existing.currentPeriodEnd) would falsely
      // reset credits when a user did downgrade-then-upgrade.
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: subscription.status,
          currentPeriodEnd: periodEndDate,
          plan,
        },
      });
      break;
    }

    case "charge.refunded": {
      // Stripe fires this when a charge is refunded — partially or
      // fully. For credit-pack purchases we claw the credits back
      // from the user's balance so a refund leaves them with no
      // unpaid-for credits. Subscription refunds are handled
      // separately via customer.subscription.* events.
      //
      // Idempotent via CreditPurchase.refundedAt: if we've already
      // processed a refund for this paymentIntent, repeated webhook
      // deliveries no-op. We only act on full refunds — partial
      // refunds get logged but leave credits alone, since cleanly
      // handling "give back 60% of credits" is more complexity than
      // it's worth for a manual support action.
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;

      if (!paymentIntentId) break;

      const purchase = await prisma.creditPurchase.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      // Not a credit-pack purchase (could be a subscription invoice
      // payment refund) — nothing to claw back here.
      if (!purchase) break;

      // Already processed — webhook retry, no action needed.
      if (purchase.refundedAt) break;

      const fullyRefunded =
        charge.amount_refunded >= charge.amount && charge.amount_refunded > 0;

      if (!fullyRefunded) {
        console.warn(
          `[stripe/webhook] partial refund on credit purchase ${purchase.id} ` +
            `(refunded ${charge.amount_refunded} of ${charge.amount}) — credits left untouched`
        );
        break;
      }

      // Full refund: decrement the user's credit balance and mark
      // the purchase as refunded. Use a transaction so a partial
      // failure doesn't leave the bookkeeping inconsistent. Clamp
      // the decrement at zero to avoid negative balances if the
      // user has already spent the credits we're now reversing —
      // a negative balance would block them from earning fresh
      // monthly credits in the next cycle.
      await prisma.$transaction(async (tx) => {
        await tx.creditPurchase.update({
          where: { id: purchase.id },
          data: { refundedAt: new Date() },
        });
        const user = await tx.user.findUnique({
          where: { id: purchase.userId },
          select: { imageCredits: true },
        });
        if (user) {
          const newBalance = Math.max(
            user.imageCredits - purchase.creditsAdded,
            0
          );
          await tx.user.update({
            where: { id: purchase.userId },
            data: { imageCredits: newBalance },
          });
        }
      });
      // Mirror the reversal in the ledger so the user sees the refund
      // in their /usage history.
      await recordLedger({
        userId: purchase.userId,
        delta: -purchase.creditsAdded,
        kind: "refund",
        source: "credits",
        note: `Refund — ${purchase.bundle} credit bundle purchase`,
      });
      break;
    }

    case "invoice.payment_succeeded": {
      // Authoritative source for "the subscription just renewed."
      // Stripe fires this on every successful renewal payment, and
      // includes billing_reason="subscription_cycle" specifically
      // for the recurring renewal (vs subscription_create which is
      // the first checkout, handled separately above).
      //
      // We rely on this — not the customer.subscription.updated
      // event's period_end change — because subscription.updated
      // can fire with stale period data in edge cases, and worse,
      // can fire on plan changes which would falsely trigger a
      // credit reset.
      const invoice = event.data.object as Stripe.Invoice;
      const billingReason = invoice.billing_reason;
      if (billingReason !== "subscription_cycle") break;

      const subId = invoice.parent?.subscription_details?.subscription;
      if (!subId) break;
      const subscriptionId =
        typeof subId === "string" ? subId : subId.id;

      const existing = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
        select: { userId: true },
      });
      if (!existing?.userId) break;

      // Pull fresh subscription state from Stripe to get the new
      // current_period_end — invoice.lines.data[0].period.end is
      // also available but the subscription is the source of truth.
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const periodEnd = subscription.items.data[0]?.current_period_end;
      const periodEndDate = periodEnd ? new Date(periodEnd * 1000) : null;
      if (!periodEndDate) break;

      // Reset the monthly counter and sync the reset date to the
      // new cycle end. Also re-stamp Subscription.currentPeriodEnd
      // so isProUser / quota calculations agree with Stripe.
      await Promise.all([
        prisma.user.update({
          where: { id: existing.userId },
          data: {
            monthlyImagesUsed: 0,
            monthlyImagesResetAt: periodEndDate,
          },
        }),
        prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { currentPeriodEnd: periodEndDate, status: "active" },
        }),
      ]);
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
