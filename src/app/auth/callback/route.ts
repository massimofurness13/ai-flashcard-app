import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicOrigin } from "@/lib/public-origin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") || "/";

  // CRITICAL: do NOT use `new URL(request.url).origin` here. On Render
  // that returns the internal proxy address `http://localhost:10000`,
  // so the post-auth redirect ships users to a dead localhost page on
  // their own machine (the exact bug a user hit during OAuth testing).
  // getPublicOrigin reads NEXT_PUBLIC_APP_URL first, then falls back
  // to X-Forwarded-* headers — both produce the real public origin.
  const origin = getPublicOrigin(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // If something went wrong, redirect to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
}
