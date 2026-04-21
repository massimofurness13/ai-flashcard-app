import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * Register a browser Push subscription for the authenticated user.
 * Uses the endpoint as the uniqueness key so re-subscribing from the
 * same device doesn't create duplicates.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { endpoint, keys, userAgent } = body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: "Missing endpoint or keys" },
      { status: 400 }
    );
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: auth.userId,
      endpoint,
      p256dhKey: keys.p256dh,
      authKey: keys.auth,
      userAgent: userAgent || null,
    },
    update: {
      userId: auth.userId,
      p256dhKey: keys.p256dh,
      authKey: keys.auth,
      userAgent: userAgent || null,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { endpoint } = body as { endpoint?: string };
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: auth.userId },
  });

  return NextResponse.json({ ok: true });
}
