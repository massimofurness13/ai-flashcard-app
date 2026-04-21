import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";

/**
 * Account metadata for the Account/Profile page: when the user signed up,
 * their subscription status + renewal date, and a last-updated timestamp
 * we can use as a "sync status" indicator in the UI.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const [user, subscription, isPro] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { createdAt: true, updatedAt: true },
    }),
    prisma.subscription.findUnique({
      where: { userId: auth.userId },
      select: {
        status: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
      },
    }),
    isProUser(auth.userId),
  ]);

  return NextResponse.json({
    createdAt: user?.createdAt?.toISOString() ?? null,
    // Using updatedAt as a "last synced" signal — it advances on every
    // auth check (requireAuth upserts), so it's effectively now-ish.
    lastSyncAt: user?.updatedAt?.toISOString() ?? null,
    isPro,
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          hasStripeCustomer: Boolean(subscription.stripeCustomerId),
        }
      : null,
  });
}
