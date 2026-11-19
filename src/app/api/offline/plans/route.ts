import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toLocalDateKey } from "@/lib/timezone";
import type { Prisma } from "@/generated/prisma/client";
const input = z.object({day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),createdAt:z.string().datetime(),picks:z.array(z.object({id:z.string().min(1).max(128),studyDirection:z.enum(["front","back"]),studyReason:z.string().max(120),group:z.enum(["practice","retention","new"]),dailyAllocation:z.object({version:z.literal(1),retentionTarget:z.number().int().min(40).max(80),assessedThroughDay:z.string().nullable(),reason:z.enum(["starting","collecting","strong-recall","weak-recall","steady"])}).optional()})).max(120)});
/** A device-created selection, never evidence of review or completion. */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  const parsed = input.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({error:"Invalid offline plan"},{status:400});
  const {day,createdAt,picks} = parsed.data;
  const started = new Date(createdAt);
  if (started.getTime()>Date.now()+300000 || started.getTime()<Date.now()-90*86400000 || new Set(picks.map(p=>p.id)).size!==picks.length) return NextResponse.json({error:"Invalid plan date or duplicate cards"},{status:400});
  const user = await prisma.user.findUnique({where:{id:auth.userId},select:{reminderTimezone:true}});
  let expected: string; try {expected=toLocalDateKey(started,user?.reminderTimezone || "UTC");}catch{expected=toLocalDateKey(started,"UTC");}
  if (day!==expected) return NextResponse.json({error:"Plan date does not match account timezone"},{status:409});
  const owned = await prisma.card.findMany({where:{id:{in:picks.map(p=>p.id)},deck:{userId:auth.userId}},select:{id:true}});
  const ids = new Set(owned.map(c=>c.id));
  const active = picks.filter(p=>ids.has(p.id));
  // Deletions since the download are harmless; never import another user's card.
  const plan = await prisma.dailyStudyPlan.upsert({where:{userId_day:{userId:auth.userId,day}},update:{},create:{userId:auth.userId,day,createdAt:started,picks:active as unknown as Prisma.InputJsonValue}});
  const canonical = (plan.picks as unknown as {id:string;studyDirection:string}[]).map(p=>`${p.id}:${p.studyDirection}`).sort();
  const supplied = active.map(p=>`${p.id}:${p.studyDirection}`).sort();
  if (JSON.stringify(canonical)!==JSON.stringify(supplied)) return NextResponse.json({error:"Another device already prepared this day's set. Your reviews will still sync."},{status:409});
  return NextResponse.json({recorded:true});
}
