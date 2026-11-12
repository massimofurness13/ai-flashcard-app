import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dailyResults } from "@/lib/study-results";
import type { DailyPick } from "@/lib/daily-study";

/** Read-only, owner-scoped daily results. Never creates a set or changes a grade. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const day = request.nextUrl.searchParams.get("day") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({error:"Invalid study day"}, {status:400});
  const plan = await prisma.dailyStudyPlan.findUnique({where:{userId_day:{userId:auth.userId,day}}});
  if (!plan) return NextResponse.json({error:"Daily set not found"}, {status:404});
  const stored = plan.picks as unknown as DailyPick[];
  // Capture the actual pre-session knowledge, including older daily sets whose
  // stored group labels predate the current retention policy.
  const before = await prisma.card.findMany({
    where:{id:{in:stored.map(p=>p.id)},deck:{userId:auth.userId,archivedAt:null}},
    select:{id:true,reviews:{where:{quality:{gt:0},reviewedAt:{lt:plan.createdAt}},orderBy:{reviewedAt:"desc"},take:2,select:{quality:true,reviewedAt:true}}},
  });
  const active = new Set(before.map(c=>c.id));
  const picks = stored.filter(p=>active.has(p.id));
  const nextPlan = await prisma.dailyStudyPlan.findFirst({where:{userId:auth.userId,createdAt:{gt:plan.createdAt}},orderBy:{createdAt:"asc"},select:{createdAt:true}});
  const logs = picks.length ? await prisma.reviewLog.findMany({
    where:{cardId:{in:picks.map(p=>p.id)},card:{deck:{userId:auth.userId}},quality:{gt:0},reviewedAt:{gte:plan.createdAt,lt:nextPlan?.createdAt ?? new Date()}},
    select:{cardId:true,direction:true,quality:true,reviewedAt:true},
  }) : [];
  return NextResponse.json(dailyResults(picks,before,logs),{headers:{"Cache-Control":"private, no-store"}});
}
