import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  await prisma.user.update({
    where: { id: auth.userId },
    data: { goalHitCelebrationShown: true },
  });

  return NextResponse.json({ ok: true });
}
