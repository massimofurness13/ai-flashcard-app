import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sm2 } from "@/lib/sm2";
import { requireAuth } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { fillRandomSession, scheduleDirection, selectStudyCards, type Orientation, type StudyCandidate } from "@/lib/study-selection";

const ReviewInput = z.object({ cardId: z.string().min(1).max(128), quality: z.number().int().min(0).max(5), direction: z.enum(["front", "back"]).optional(), eventId: z.string().uuid().optional(), reviewedAt: z.string().datetime().optional() });
const filters = ["due", "random", "mastery", "created", "recent", "alpha"];
const integer = (value: string | null, fallback: number, max: number) => {
  const n = Number(value ?? fallback);
  return Number.isSafeInteger(n) && n >= 0 ? Math.min(n,max) : fallback;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const params = request.nextUrl.searchParams;
  const filter = filters.includes(params.get("filter") || "") ? params.get("filter")! : "due";
  const orientation = (["front","back","mixed","auto"].includes(params.get("orientation") || "") ? params.get("orientation") : "auto") as Orientation;
  const limit = Math.max(1,integer(params.get("limit"),20,500));
  const offset = integer(params.get("offset"),0,1_000_000);
  const cutoff = integer(params.get("recencyCutoff"),0,3650);
  const now = new Date();
  const where: Prisma.CardWhereInput = { deck: { userId: auth.userId, archivedAt: null } };
  const deckIds = params.get("deckIds")?.split(",").filter(Boolean);
  if (deckIds?.length) where.deckId = { in: deckIds };
  // Only explicit user exclusions: the old 6-hour blanket also hid failed cards.
  if (cutoff) where.reviews = { none: { reviewedAt: { gte: new Date(now.getTime()-cutoff*86400000) } } };
  const tags = (params.get("tags") || "").split(",").map(t=>t.trim().toLowerCase()).filter(Boolean);
  const candidates: StudyCandidate[] = [];
  let cursor: string | undefined;
  // Scan lightweight metadata across ALL selected packs, not an oldest-first subset.
  while (true) {
    const batch = await prisma.card.findMany({ where, orderBy: { id: "asc" }, take: 1000,
      ...(cursor ? { cursor: {id:cursor}, skip:1 } : {}),
      select: { id:true, front:true, tags:true, createdAt:true, easeFactor:true, interval:true,
        repetitions:true, nextReviewAt:true, recallStates:true,
        reviews:{where:{quality:{gt:0}},orderBy:{reviewedAt:"desc"},take:1,select:{quality:true,reviewedAt:true}} }
    });
    candidates.push(...batch.filter(c=>tags.every(t=>(c.tags||"").split(",").map(s=>s.trim().toLowerCase()).includes(t))));
    if(batch.length<1000)break;
    cursor=batch.at(-1)!.id;
  }
  const eligible = selectStudyCards(candidates,filter,orientation,now);
  const selected = filter === "random" ? fillRandomSession(eligible,limit) : eligible.slice(offset,offset+limit);
  const cards = selected.length ? await prisma.card.findMany({where:{...where,id:{in:[...new Set(selected.map(c=>c.id))]}},include:{deck:{select:{id:true,name:true,emoji:true,frontVoice:true,backVoice:true,frontLanguageCode:true,backLanguageCode:true}}}}) : [];
  const byId = new Map(cards.map(c=>[c.id,c]));
  const user = await prisma.user.findUnique({where:{id:auth.userId},select:{learningLanguage:true}});
  return NextResponse.json({cards:selected.flatMap(p=>{const c=byId.get(p.id);return c?[{...c,...p}]:[];}),totalDue:eligible.length,total:eligible.length,
    nextOffset: offset+limit<eligible.length ? offset+limit : null, learningLanguage:user?.learningLanguage??null},
    {headers:{"Cache-Control":"private, no-store"}});
}

// Ratings are idempotent and atomic: retries cannot spend a second review.
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const parsed = ReviewInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  const { cardId, quality, eventId, reviewedAt, direction } = parsed.data;
  const when = reviewedAt ? new Date(reviewedAt) : new Date();
  if (when.getTime() > Date.now() + 300_000 || when.getTime() < Date.now() - 90 * 86400_000) {
    return NextResponse.json({ error: "Review date is outside the sync window." }, { status: 400 });
  }
  const id = createHash("sha256").update(auth.userId + ":" + (eventId ?? randomUUID())).digest("hex");
  const result = await prisma.$transaction(async tx => {
    // Serialize updates to a card across devices and simultaneous retries.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT c.id FROM "Card" c JOIN "Deck" d ON d.id = c."deckId"
      WHERE c.id = ${cardId} AND d."userId" = ${auth.userId} FOR UPDATE OF c
    `;
    if (!locked.length) return { error: "Card not found", status: 404 };
    const existing = await tx.reviewLog.findUnique({ where: { id } });
    if (existing) return existing.cardId === cardId && existing.quality === quality && (existing.direction ?? null) === (direction ?? null)
      ? { recorded: true, duplicate: true }
      : { error: "Review identifier already used", status: 409 };
    const card = await tx.card.findUniqueOrThrow({ where: { id: cardId } });
    const latest = await tx.reviewLog.findFirst({ where: { cardId, quality: {gt:0} }, orderBy: { reviewedAt: "desc" } });
    // Keep delayed offline history, but don't rewind a newer device's schedule.
    const updateSchedule = quality !== 0 && (!latest || latest.reviewedAt <= when);
    const next = updateSchedule ? sm2(quality, card) : null;
    if (next) {
      next.nextReviewAt = new Date(when.getTime()+next.interval*86400000);
      await tx.card.update({ where: { id: cardId }, data: next });
    }
    // Independent clocks: a newer opposite-side rating cannot discard this side.
    let directionalNext = null;
    if (direction && quality !== 0) {
      const key = {cardId_direction:{cardId,direction}};
      const previous = await tx.cardRecall.findUnique({where:key});
      if (!previous || previous.lastReviewedAt <= when) {
        directionalNext = scheduleDirection(quality,previous,when);
        const data = {...directionalNext,lastQuality:quality,lastReviewedAt:when};
        await tx.cardRecall.upsert({where:key,create:{cardId,direction,...data},update:data});
      }
    }
    await tx.reviewLog.create({ data: {
      id, cardId, quality, reviewedAt: when, direction: direction ?? null,
      easeFactor: directionalNext?.easeFactor ?? next?.easeFactor ?? card.easeFactor,
      interval: directionalNext?.interval ?? next?.interval ?? card.interval,
    } });
    return { recorded: true, passive: quality === 0, interval: directionalNext?.interval ?? next?.interval ?? card.interval };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
