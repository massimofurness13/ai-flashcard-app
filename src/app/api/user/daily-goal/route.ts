import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const goal = Number(body.dailyGoal);

  if (!Number.isInteger(goal) || goal < 1 || goal > 500) {
    return NextResponse.json(
      { error: "dailyGoal must be an integer between 1 and 500" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: { dailyGoal: goal },
  });

  return NextResponse.json({ dailyGoal: goal });
}
