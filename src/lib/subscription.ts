import { prisma } from "@/lib/db";

const PRO_ALLOWLIST = (process.env.PRO_ALLOWLIST || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Check if a user has an active Pro subscription.
 * Also grants Pro access to emails in the PRO_ALLOWLIST env var.
 */
export async function isProUser(userId: string): Promise<boolean> {
  // Check allowlist first (owner/admin bypass)
  if (PRO_ALLOWLIST.length > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user && PRO_ALLOWLIST.includes(user.email.toLowerCase())) {
      return true;
    }
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) return false;

  return (
    subscription.status === "active" &&
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd > new Date()
  );
}

/**
 * Get the subscription status for a user.
 */
export async function getSubscription(userId: string) {
  return prisma.subscription.findUnique({
    where: { userId },
  });
}

/**
 * The free trial window during which AI-generated illustrations
 * stay viewable for non-Pro users. After this window expires, the
 * images aren't deleted — we never lose user data — but they
 * render blurred behind a "Resubscribe to view" overlay until the
 * user upgrades.
 *
 * 30 days = a clean month for a new user to burn through their
 * 25 lifetime credits and see the results. Long enough to fall in
 * love with the illustration experience, short enough that the
 * conversion ask lands before the novelty fades.
 */
export const FREE_IMAGE_VIEW_TRIAL_DAYS = 30;

/**
 * Whether a given user is currently entitled to *view* AI-generated
 * illustrations unblurred.
 *
 * Two ways to qualify:
 *   1. Active Pro subscription — Pro users always see their
 *      generated images.
 *   2. Free trial — within the first 30 days of account creation,
 *      a non-Pro user can still see any images they generated with
 *      their 25 lifetime credits.
 *
 * Outside both windows (non-Pro past trial; ex-Pro lapsed) the
 * blur overlay kicks in. The image bytes are still on the user's
 * Supabase storage, so re-subscribing restores visibility
 * instantly with no refetch.
 */
export async function canViewAiImages(userId: string): Promise<boolean> {
  if (await isProUser(userId)) return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  if (!user) return false;

  const trialEndMs =
    user.createdAt.getTime() +
    FREE_IMAGE_VIEW_TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() < trialEndMs;
}
