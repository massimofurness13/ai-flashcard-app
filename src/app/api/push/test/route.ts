import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { sendPush } from "@/lib/web-push";

/**
 * Send a one-off test notification to every subscription for the
 * authenticated user — lets them verify that permission and service
 * worker are wired up correctly before trusting the daily reminder.
 */
export async function POST() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: auth.userId },
  });

  if (subs.length === 0) {
    return NextResponse.json(
      { error: "No push subscriptions registered on this device" },
      { status: 400 }
    );
  }

  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    const result = await sendPush(sub, {
      title: "FlashMind test",
      body: "If you see this, push notifications are working.",
      url: "/account",
      tag: "flashmind-test",
    });
    if (result.ok) {
      sent++;
    } else if (result.gone) {
      await prisma.pushSubscription.delete({ where: { id: sub.id } });
      pruned++;
    }
  }

  return NextResponse.json({ sent, pruned });
}
