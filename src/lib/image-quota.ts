import { prisma } from "@/lib/db";
import { isProUser, FREE_IMAGE_VIEW_TRIAL_DAYS } from "@/lib/subscription";
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

// 25 credits = enough for 5 premium illustrations (5 credits each)
// or 25 quick illustrations. The free trial point: try it both ways
// and feel which one sticks before paying for Pro.
export const FREE_LIFETIME_CREDITS = 25;
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
  /** Whether the user can currently *view* AI illustrations
   *  unblurred. True for active Pro users AND non-Pro users still
   *  in their 30-day free image-viewing trial; false otherwise. */
  canViewAiImages: boolean;
  /** ISO timestamp when the free image-viewing trial ends. Useful
   *  for surfaces that want to say "your trial ends in N days".
   *  Null for Pro users (no trial concept while subscribed) and
   *  for users whose trial has already expired. */
  freeViewTrialEndsAt: Date | null;
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
        createdAt: true,
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

  // Image-viewing entitlement. Pro users always see their illustrations.
  // Non-Pro users get a 30-day window from account creation during which
  // any images they generate (using their 25 lifetime credits) stay
  // visible. After 30 days, the blur kicks in until they subscribe.
  const trialEnd = user
    ? new Date(
        user.createdAt.getTime() +
          FREE_IMAGE_VIEW_TRIAL_DAYS * 24 * 60 * 60 * 1000,
      )
    : null;
  const inFreeViewTrial =
    !isPro && trialEnd !== null && trialEnd.getTime() > Date.now();
  const canViewAiImages = isPro || inFreeViewTrial;
  const freeViewTrialEndsAt = inFreeViewTrial ? trialEnd : null;

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
      canViewAiImages,
      freeViewTrialEndsAt,
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
    canViewAiImages,
    freeViewTrialEndsAt,
  };
}

export type ConsumeResult =
  | { ok: true; source: "monthly" | "credits" | "free"; amountUsed: number }
  | { ok: false; reason: "out_of_quota"; state: QuotaState };

/**
 * Atomically consume N credits for the requested tier.
 * Draws first from monthly allowance, then purchased credits, then
 * lifetime free trial. Must fit the whole tier cost in ONE source —
 * no cross-source splitting.
 *
 * Race-safe: each spend path is a single conditional `updateMany`
 * with the precondition baked into the WHERE clause. Two concurrent
 * requests with the same userId can NEVER both succeed on the same
 * source — Postgres serialises the writes and the loser sees
 * `count === 0`, falls through to the next source. Previous version
 * did read-then-write which let bursts overspend during cache windows.
 */
export async function consumeImageCredit(
  userId: string,
  tier: ImageTier = "quick"
): Promise<ConsumeResult> {
  const cost = TIER_COSTS[tier];
  const now = new Date();
  const nextResetAt = new Date();
  nextResetAt.setMonth(nextResetAt.getMonth() + 1);

  const isPro = await isProUser(userId);

  if (isPro) {
    const sub = await prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true },
    });
    const allowance =
      sub?.plan === "yearly" ? PRO_YEARLY_CREDITS : PRO_MONTHLY_CREDITS;

    // First-time monthly use (no reset date set yet) — initialise.
    const initResult = await prisma.user.updateMany({
      where: { id: userId, monthlyImagesResetAt: null },
      data: {
        monthlyImagesUsed: cost,
        monthlyImagesResetAt: nextResetAt,
      },
    });
    if (initResult.count === 1) {
      return { ok: true, source: "monthly", amountUsed: cost };
    }

    // Cycle expired — reset usage and charge in one atomic update.
    const resetResult = await prisma.user.updateMany({
      where: { id: userId, monthlyImagesResetAt: { lte: now } },
      data: {
        monthlyImagesUsed: cost,
        monthlyImagesResetAt: nextResetAt,
      },
    });
    if (resetResult.count === 1) {
      return { ok: true, source: "monthly", amountUsed: cost };
    }

    // Normal in-cycle increment. The `monthlyImagesUsed: { lte: allowance - cost }`
    // precondition is what makes this race-safe — if N concurrent
    // requests all see "100 used, 500 limit", only some will pass
    // this WHERE clause depending on the order Postgres applies the
    // writes; the rest get count=0 and try the next source.
    const incResult = await prisma.user.updateMany({
      where: {
        id: userId,
        monthlyImagesResetAt: { gt: now },
        monthlyImagesUsed: { lte: allowance - cost },
      },
      data: { monthlyImagesUsed: { increment: cost } },
    });
    if (incResult.count === 1) {
      return { ok: true, source: "monthly", amountUsed: cost };
    }
  }

  // Purchased credits — never expire, available to everyone.
  const creditsResult = await prisma.user.updateMany({
    where: { id: userId, imageCredits: { gte: cost } },
    data: { imageCredits: { decrement: cost } },
  });
  if (creditsResult.count === 1) {
    return { ok: true, source: "credits", amountUsed: cost };
  }

  // Lifetime free trial — non-Pro only.
  if (!isPro) {
    const freeResult = await prisma.user.updateMany({
      where: {
        id: userId,
        lifetimeFreeImagesUsed: { lte: FREE_LIFETIME_CREDITS - cost },
      },
      data: { lifetimeFreeImagesUsed: { increment: cost } },
    });
    if (freeResult.count === 1) {
      return { ok: true, source: "free", amountUsed: cost };
    }
  }

  // Everyone failed — read state for the error response.
  const state = await getQuotaState(userId);
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
