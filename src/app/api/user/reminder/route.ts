import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * Set or clear the user's daily reminder time.
 *
 * Body: { hour: number | null, timezone?: string }
 *   hour: 0-23 local-time hour, or null to disable reminders
 *   timezone: IANA zone (e.g. "Europe/London"); captured client-side
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const hour = body.hour;
  const timezone = typeof body.timezone === "string" ? body.timezone : null;

  if (hour !== null && hour !== undefined) {
    if (typeof hour !== "number" || hour < 0 || hour > 23) {
      return NextResponse.json({ error: "hour must be 0-23" }, { status: 400 });
    }
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      reminderHour: hour ?? null,
      // Only update timezone when the client passes one so we don't
      // accidentally clobber a good value when just toggling off.
      ...(timezone ? { reminderTimezone: timezone } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { reminderHour: true, reminderTimezone: true },
  });

  return NextResponse.json({
    reminderHour: user?.reminderHour ?? null,
    reminderTimezone: user?.reminderTimezone ?? null,
  });
}
