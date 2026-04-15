import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isProUser } from "@/lib/subscription";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const isPro = await isProUser(auth.userId);
  return NextResponse.json({ isPro });
}
