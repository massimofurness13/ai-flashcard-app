import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getQuotaState } from "@/lib/image-quota";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const state = await getQuotaState(auth.userId);
  return NextResponse.json(state);
}
