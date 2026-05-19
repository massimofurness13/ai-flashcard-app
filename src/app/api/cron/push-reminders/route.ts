import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPush } from "@/lib/web-push";

/**
 * Cron: send daily-study push reminders.
 *
 * Expected to be triggered on a schedule (e.g. every 15 minutes) by
 * Render / Vercel cron / external scheduler, carrying a matching
 * `x-cron-secret` header. We look for users whose reminderHour matches
 * the CURRENT hour in their declared timezone and whose goal hasn't
 * been hit yet today, then send to every push subscription they have.
 *
 * Protection against double-send: we stamp User.lastReminderSentAt when
 * we send and skip if it's already in today's local window.
 */

const MINUTES_WINDOW = 30; // match users whose reminder is within the last 30 min

function getCurrentHourInZone(tz: string): number | null {
  try {
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(new Date());
    const hour = parseInt(hourStr, 10);
    return Number.isFinite(hour) ? hour % 24 : null;
  } catch {
    return null;
  }
}

function getLocalDateKey(tz: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  if (request.headers.get("x-cron-secret") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Candidates: any user with reminders enabled and at least one subscription
  const users = await prisma.user.findMany({
    where: {
      reminderHour: { not: null },
      reminderTimezone: { not: null },
      pushSubscriptions: { some: {} },
    },
    select: {
      id: true,
      reminderHour: true,
      reminderTimezone: true,
      dailyGoal: true,
      lastReminderSentAt: true,
      pushSubscriptions: {
        select: {
          id: true,
          endpoint: true,
          p256dhKey: true,
          authKey: true,
        },
      },
    },
  });

  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);
  // Use a 24h lookback rather than midnight-UTC to be safe across timezones
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let sent = 0;
  let pruned = 0;

  for (const user of users) {
    if (user.reminderHour === null || !user.reminderTimezone) continue;

    const localHour = getCurrentHourInZone(user.reminderTimezone);
    if (localHour === null) continue;
    if (localHour !== user.reminderHour) continue;

    // Skip if we've already sent within the window
    if (
      user.lastReminderSentAt &&
      user.lastReminderSentAt.getTime() > Date.now() - MINUTES_WINDOW * 60 * 1000
    ) {
      continue;
    }

    // Skip if they already hit today's goal
    const reviewsToday = await prisma.reviewLog.count({
      where: {
        reviewedAt: { gte: oneDayAgo },
        card: { deck: { userId: user.id } },
      },
    });
    if (reviewsToday >= user.dailyGoal) continue;

    const remaining = Math.max(user.dailyGoal - reviewsToday, 0);
    const payload = {
      title: "Time for today's cards",
      body:
        remaining > 0
          ? `${remaining} to go to hit your daily goal.`
          : "Open Huella to keep your streak alive.",
      url: "/study",
      tag: `huella-${getLocalDateKey(user.reminderTimezone) || "reminder"}`,
    };

    for (const sub of user.pushSubscriptions) {
      const result = await sendPush(sub, payload);
      if (result.ok) {
        sent++;
      } else if (result.gone) {
        // Subscription is dead at the push service, clean up
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
        pruned++;
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastReminderSentAt: new Date() },
    });
  }

  return NextResponse.json({ sent, pruned, candidatesChecked: users.length });
}
