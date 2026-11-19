import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { bearerToken } from "./bearer";

export async function updateSession(request: NextRequest) {
  // Public UI shells only. Account data still requires authenticated APIs.
  // Server-rendered edit pages and API routes must not bypass authentication.
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/") && request.headers.has("authorization") && !path.startsWith("/api/cron/")) {
    const token = bearerToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({error:"Unauthorized"},{status:401});
    const client = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error} = await client.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({error:"Unauthorized"},{status:401});
    // Handlers also verify the token and their resource's ownership.
    return NextResponse.next({request});
  }
  if (/^\/pdf\.worker\.\d+\.\d+\.\d+\.min\.mjs$/.test(path)
      || ["/", "/study/session", "/study", "/stats", "/account", "/account/billing", "/account/downloads"].includes(path)
      || (path !== "/decks/new" && /^\/decks\/[^/]+$/.test(path))) return NextResponse.next({ request });
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require auth
  const publicRoutes = [
    "/auth/login",
    "/auth/signup",
    "/auth/callback",
    "/auth/confirm",
    "/pricing",
    "/privacy",
    "/terms",
  ];
  // API routes that carry their own authentication (cron secret, webhook
  // signature, etc.) — they must not be routed through the user-auth
  // redirect below or they'd 307 to /auth/login instead of running.
  const selfAuthenticatedApiRoutes = [
    "/api/cron/",
    "/api/stripe/webhook",
    // Landing-page demo TTS — phrase whitelist enforces its own
    // tight scoping; serves anonymous marketing visitors so the
    // demo speaker button works pre-signup.
    "/api/landing/",
  ];
  // Static-file paths the browser fetches on every page load (PWA manifest,
  // service worker, icons). Redirecting these to /auth/login would make the
  // browser try to parse the login HTML as JSON/JS and throw console errors.
  //
  // `/manifest.webmanifest` and `/icon`, `/apple-icon` are served by Next
  // 16's app/manifest.ts + app/icon.tsx + app/apple-icon.tsx respectively.
  const publicStaticPaths = [
    "/native-upgrade.html",
    "/manifest.webmanifest",
    "/sw.js",
    "/icon",
    "/apple-icon",
    "/favicon.ico",
    "/robots.txt",
  ];
  const isDemoMode =
    request.nextUrl.searchParams.get("demo") === "1" &&
    (request.nextUrl.pathname === "/stats" ||
      request.nextUrl.pathname === "/api/stats");
  const isPublicRoute =
    isDemoMode ||
    request.nextUrl.pathname === "/" ||
    publicRoutes.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    ) ||
    selfAuthenticatedApiRoutes.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    ) ||
    publicStaticPaths.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages (not all public routes)
  const isAuthPage = ["/auth/login", "/auth/signup"].some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
