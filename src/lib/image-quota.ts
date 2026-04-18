import { prisma } from "@/lib/db";
import { isProUser } from "@/lib/subscription";

/**
 * Quota rules:
 *   - Free tier: 3 AI images per account (lifetime, to try the feature)
 *   - Pro tier:  150 AI images per calendar month, refreshes on billing date
 *   - Credits:   purchased on top of monthly allowance, never expire
 *
 * Order of consumption:
 *   1. Monthly allowance first (if within window and under cap)
 *   2. Purchased credits second
 *   3. Lifetime free-trial counter (for non-Pro users only)
 */

export const FREE_LIFETIME_LIMIT = 3;
export const PRO_MONTHLY_LIMIT = 150;

export type QuotaState = {
  isPro: boolean;
  monthlyUsed: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  credits: number;
  lifetimeFreeUsed: number;
  lifetimeFreeRemaining: number;
  totalRemaining: number;
  resetAt: Date | null;
  canGenerate: boolean;
};

/**
 * Get the user's current image quota state without mutating anything.
 * Used by UI to display "X / 150 images this month" etc.
 */
export async function getQuotaState(userId: string): Promise<QuotaState> {
  const [user, isPro] = await Promise.all([
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
  ]);

  if (!user) {
    return emptyState(isPro);
  }

  // Check if the monthly counter needs to reset
  const now = new Date();
  const effectiveUsed =
    user.monthlyImagesResetAt && user.monthlyImagesResetAt <= now
      ? 0
      : user.monthlyImagesUsed;

  const monthlyLimit = isPro ? PRO_MONTHLY_LIMIT : 0;
  const monthlyRemaining = Math.max(monthlyLimit - effectiveUsed, 0);
  const lifetimeFreeRemaining = isPro
    ? 0
    : Math.max(FREE_LIFETIME_LIMIT - user.lifetimeFreeImagesUsed, 0);

  return {
    isPro,
    monthlyUsed: effectiveUsed,
    monthlyLimit,
    monthlyRemaining,
    credits: user.imageCredits,
    lifetimeFreeUsed: user.lifetimeFreeImagesUsed,
    lifetimeFreeRemaining,
    totalRemaining: monthlyRemaining + user.imageCredits + lifetimeFreeRemaining,
    resetAt: user.monthlyImagesResetAt,
    canGenerate:
      monthlyRemaining > 0 || user.imageCredits > 0 || lifetimeFreeRemaining > 0,
  };
}

function emptyState(isPro: boolean): QuotaState {
  return {
    isPro,
    monthlyUsed: 0,
    monthlyLimit: isPro ? PRO_MONTHLY_LIMIT : 0,
    monthlyRemaining: isPro ? PRO_MONTHLY_LIMIT : 0,
    credits: 0,
    lifetimeFreeUsed: 0,
    lifetimeFreeRemaining: isPro ? 0 : FREE_LIFETIME_LIMIT,
    totalRemaining: isPro ? PRO_MONTHLY_LIMIT : FREE_LIFETIME_LIMIT,
    resetAt: null,
    canGenerate: true,
  };
}

export type ConsumeResult =
  | { ok: true; source: "monthly" | "credits" | "free" }
  | { ok: false; reason: "out_of_quota"; state: QuotaState };

/**
 * Atomically consume one image credit. Returns which source was used,
 * or a descriptive failure if the user has no quota left.
 */
export async function consumeImageCredit(userId: string): Promise<ConsumeResult> {
  const state = await getQuotaState(userId);

  if (!state.canGenerate) {
    return { ok: false, reason: "out_of_quota", state };
  }

  // Reset the monthly counter if the window has expired
  const now = new Date();
  const needsReset = state.resetAt !== null && state.resetAt <= now;
  const nextResetAt = new Date();
  nextResetAt.setMonth(nextResetAt.getMonth() + 1);

  // Decide source: monthly → credits → free
  if (state.isPro && (needsReset || state.monthlyRemaining > 0)) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyImagesUsed: needsReset ? 1 : { increment: 1 },
        monthlyImagesResetAt:
          state.resetAt === null || needsReset ? nextResetAt : undefined,
      },
    });
    return { ok: true, source: "monthly" };
  }

  if (state.credits > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { imageCredits: { decrement: 1 } },
    });
    return { ok: true, source: "credits" };
  }

  if (!state.isPro && state.lifetimeFreeRemaining > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { lifetimeFreeImagesUsed: { increment: 1 } },
    });
    return { ok: true, source: "free" };
  }

  return { ok: false, reason: "out_of_quota", state };
}

/**
 * Refund a consumed credit — called when image generation fails after
 * the credit was deducted, so users aren't charged for failures.
 */
export async function refundImageCredit(
  userId: string,
  source: "monthly" | "credits" | "free"
): Promise<void> {
  if (source === "monthly") {
    await prisma.user.update({
      where: { id: userId },
      data: { monthlyImagesUsed: { decrement: 1 } },
    });
  } else if (source === "credits") {
    await prisma.user.update({
      where: { id: userId },
      data: { imageCredits: { increment: 1 } },
    });
  } else if (source === "free") {
    await prisma.user.update({
      where: { id: userId },
      data: { lifetimeFreeImagesUsed: { decrement: 1 } },
    });
  }
}

/**
 * Add purchased credits after a successful Stripe checkout.
 */
export async function addCredits(userId: string, amount: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { imageCredits: { increment: amount } },
  });
}
