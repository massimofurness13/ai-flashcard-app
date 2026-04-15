import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * Get the current user without redirecting.
 * Returns null if not authenticated.
 */
export async function getOptionalUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the current authenticated user for server components.
 * Redirects to login if not authenticated.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return user;
}

/**
 * Get the current user's ID for server components.
 * Redirects to login if not authenticated.
 */
export async function getUserId(): Promise<string> {
  const user = await getUser();
  return user.id;
}

/**
 * Ensure the user exists in our Prisma database.
 * Creates the user record if it doesn't exist (first login).
 * Returns the userId.
 */
export async function ensureUser(): Promise<string> {
  const user = await getUser();

  // Upsert user in our database
  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email || "",
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatarUrl: user.user_metadata?.avatar_url || null,
    },
    create: {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatarUrl: user.user_metadata?.avatar_url || null,
    },
  });

  return user.id;
}

/**
 * Require authentication for API routes.
 * Returns userId or sends 401 response.
 */
export async function requireAuth(): Promise<
  | { userId: string; error?: never }
  | { userId?: never; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // Ensure user exists in our database
  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email || "",
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatarUrl: user.user_metadata?.avatar_url || null,
    },
    create: {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatarUrl: user.user_metadata?.avatar_url || null,
    },
  });

  return { userId: user.id };
}
