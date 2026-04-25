import { prisma } from "@/lib/db";
import { isProUser } from "@/lib/subscription";
import type { ImageTier } from "@/lib/image-gen";

/**
 * Unified credit system:
 *   Quick ✨  = 1 credit (FLUX schnell, $0.003 cost)
 *   Premium 🎨 = 5 credits (FLUX dev, $0.025 cost)
 *
 * Free tier:    15 lifetime credits (= 15 Quick or 3 Premium) to try the feature
 * Pro Monthly:  500 credits per month, refreshes on Stripe billing cycle
 * Pro Yearly:   6,000 credits per year, ALL unlocked upfront on activation,
 *               refreshes once a year. Designed for migration use cases —
 *               port an entire Anki library, illustrate it in one go.
 * Top-ups:      Purchased credits stack on top, NEVER expire.
 *
 * Order of consumption: subscription allowance first, then purchased
 * credits, then lifetime free-trial credits. Subscription credits expire
 * at cycle end; purchased credits are owned by the user forever.
 */

export const FREE_LIFETIME_CREDITS = 15;
export const PRO_MONTHLY_CREDITS = 500;
export const PRO_YEARLY_CREDITS = 6000;

export const TIER_COSTS: Record<ImageTier, number> = {
  quick: 1,
  premium: 5,
};

export type SubscriptionPlan = "monthly" | "yearly";

export type QuotaState = {
  isPro: boolean;
  /** "monthly" | "yearly" — null when not Pro */
  plan: SubscriptionPlan | null;
  /** Credits consumed in the current billing window */
  monthlyUsed: number;
  /** Credits granted by the current subscription tier (500 monthly, 6000 yearly) */
  monthlyLimit: number;
  monthlyRemaining: number;
  credits: number;
  lifetimeFreeUsed: number;
  lifetimeFreeRemaining: number;
  totalRemaining: number;
  resetAt: Date | null;
  canAffordQuick: boolean;
  canAffordPremium: boolean;
};

export async function getQuotaState(userId: string): Promise<QuotaState> {
  const [user, isPro, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        monthlyImagesUsed: true,
        monthlyImagesResetAt: true,
        imageCredits: true,
        lifetimeFreeImagesUsed: true,
      },
    }),
    isProUser(userId),
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    }),
  ]);

  // Plan only counts when the subscription is active. A canceled or
  // past-due yearly user falls back to "no allowance" — they keep
  // any purchased top-up credits but lose subscription credits.
  const plan: SubscriptionPlan | null =
    isPro && subscription?.plan === "yearly" ? "yearly" : isPro ? "monthly" : null;

  const allowance =
    plan === "yearly"
      ? PRO_YEARLY_CREDITS
      : plan === "monthly"
        ? PRO_MONTHLY_CREDITS
        : 0;

  if (!user) {
    return {
      isPro,
      plan,
      monthlyUsed: 0,
      monthlyLimit: allowance,
      monthlyRemaining: allowance,
      credits: 0,
      lifetimeFreeUsed: 0,
      lifetimeFreeRemaining: isPro ? 0 : FREE_LIFETIME_CREDITS,
      totalRemaining: isPro ? allowance : FREE_LIFETIME_CREDITS,
      resetAt: null,
      canAffordQuick: true,
      canAffordPremium: isPro
        ? allowance >= TIER_COSTS.premium
        : FREE_LIFETIME_CREDITS >= TIER_COSTS.premium,
    };
  }

  const now = new Date();
  const effectiveUsed =
    user.monthlyImagesResetAt && user.monthlyImagesResetAt <= now
      ? 0
      : user.monthlyImagesUsed;

  const monthlyLimit = allowance;
  const monthlyRemaining = Math.max(monthlyLimit - effectiveUsed, 0);
  const lifetimeFreeRemaining = isPro
    ? 0
    : Math.max(FREE_LIFETIME_CREDITS - user.lifetimeFreeImagesUsed, 0);
  const totalRemaining = monthlyRemaining + user.imageCredits + lifetimeFreeRemaining;

  return {
    isPro,
    plan,
    monthlyUsed: effectiveUsed,
    monthlyLimit,
    monthlyRemaining,
    credits: user.imageCredits,
    lifetimeFreeUsed: user.lifetimeFreeImagesUsed,
    lifetimeFreeRemaining,
    totalRemaining,
    resetAt: user.monthlyImagesResetAt,
    canAffordQuick: totalRemaining >= TIER_COSTS.quick,
    canAffordPremium: totalRemaining >= TIER_COSTS.premium,
  };
}

export type ConsumeResult =
  | { ok: true; source: "monthly" | "credits" | "free"; amountUsed: number }
  | { ok: false; reason: "out_of_quota"; state: QuotaState };

/**
 * Atomically consume N credits for the requested tier.
 * Draws first from monthly allowance, then credits, then lifetime free.
 * Must be able to fit the whole tier cost in ONE source — no cross-source splitting.
 */
export async function consumeImageCredit(
  userId: string,
  tier: ImageTier = "quick"
): Promise<ConsumeResult> {
  const cost = TIER_COSTS[tier];
  const state = await getQuotaState(userId);

  const now = new Date();
  const needsReset = state.resetAt !== null && state.resetAt <= now;
  const nextResetAt = new Date();
  nextResetAt.setMonth(nextResetAt.getMonth() + 1);

  // Try sources in order, each must fit the whole cost to be picked
  const monthlyAvailable = state.isPro
    ? (needsReset ? state.monthlyLimit : state.monthlyRemaining)
    : 0;
  if (monthlyAvailable >= cost) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyImagesUsed: needsReset ? cost : { increment: cost },
        monthlyImagesResetAt:
          state.resetAt === null || needsReset ? nextResetAt : undefined,
      },
    });
    return { ok: true, source: "monthly", amountUsed: cost };
  }

  if (state.credits >= cost) {
    await prisma.user.update({
      where: { id: userId },
      data: { imageCredits: { decrement: cost } },
    });
    return { ok: true, source: "credits", amountUsed: cost };
  }

  if (!state.isPro && state.lifetimeFreeRemaining >= cost) {
    await prisma.user.update({
      where: { id: userId },
      data: { lifetimeFreeImagesUsed: { increment: cost } },
    });
    return { ok: true, source: "free", amountUsed: cost };
  }

  return { ok: false, reason: "out_of_quota", state };
}

export async function refundImageCredit(
  userId: string,
  source: "monthly" | "credits" | "free",
  amount: number
): Promise<void> {
  if (source === "monthly") {
    await prisma.user.update({
      where: { id: userId },
      data: { monthlyImagesUsed: { decrement: amount } },
    });
  } else if (source === "credits") {
    await prisma.user.update({
      where: { id: userId },
      data: { imageCredits: { increment: amount } },
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { lifetimeFreeImagesUsed: { decrement: amount } },
    });
  }
}

export async function addCredits(userId: string, amount: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { imageCredits: { increment: amount } },
  });
}

/**
 * Set the user's monthly reset date to match their Stripe billing cycle end.
 * Called from the Stripe webhook when subscription is created or renewed.
 */
export async function syncResetDateToBillingCycle(
  userId: string,
  billingCycleEnd: Date
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { monthlyImagesResetAt: billingCycleEnd },
  });
}
