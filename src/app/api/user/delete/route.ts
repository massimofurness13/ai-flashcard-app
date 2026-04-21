import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * Permanently delete the authenticated user and all their data.
 *
 * Order matters: we delete the Prisma user first (cascades to folders,
 * decks, cards, reviews, subscription, credit purchases), then remove
 * the Supabase auth user so they can't sign back in with the same
 * session cookie. The client is responsible for signing out + redirect.
 *
 * This is destructive and irreversible. Images in Supabase storage are
 * not swept here — they're orphaned by userId path and can be cleaned
 * later via a background job.
 */
export async function DELETE() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Server misconfigured: missing Supabase service role" },
      { status: 500 }
    );
  }

  // 1. Cascade-delete all app data for this user
  await prisma.user.delete({ where: { id: auth.userId } });

  // 2. Delete the Supabase auth row so the session is invalidated server-side
  const admin = createServiceClient(supabaseUrl, serviceKey);
  const { error } = await admin.auth.admin.deleteUser(auth.userId);
  if (error) {
    // Prisma row is already gone; log and continue so the client can sign out.
    console.error("Supabase auth user delete failed:", error);
  }

  return NextResponse.json({ success: true });
}
