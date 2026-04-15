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
