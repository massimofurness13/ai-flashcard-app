import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { bearerToken } from "./bearer";

export async function createClient() {
  const authorization = (await headers()).get("authorization");
  if (authorization) {
    // An invalid bearer must never fall back to a different cookie account.
    const token = bearerToken(authorization) ?? "invalid";
    return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component where cookies can't be set.
            // This is fine if middleware refreshes the session.
          }
        },
      },
    }
  );
}
