import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluateFsrsTrial } from "@/lib/fsrs-trial";

const MAX_REVIEWS=20_000;
export async function GET() {
  const auth=await requireAuth();
  if (auth.error) return auth.error;
  // Oldest first preserves initial history. If capped, explicitly report the
  // cutoff rather than pretending truncated history is a fresh memory state.
  const reviews=await prisma.reviewLog.findMany({
    where:{card:{deck:{userId:auth.userId,archivedAt:null}},quality:{gt:0},reviewedAt:{lte:new Date()}},
    orderBy:[{reviewedAt:"asc"},{id:"asc"}],take:MAX_REVIEWS+1,
    select:{id:true,cardId:true,direction:true,quality:true,reviewedAt:true,interval:true},
  });
  return NextResponse.json(evaluateFsrsTrial(reviews.slice(0,MAX_REVIEWS),reviews.length>MAX_REVIEWS),{headers:{"Cache-Control":"private, no-store"}});
}
