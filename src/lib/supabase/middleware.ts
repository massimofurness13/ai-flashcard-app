import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
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
  ];
  // Static-file paths the browser fetches on every page load (PWA manifest,
  // service worker, icons). Redirecting these to /auth/login would make the
  // browser try to parse the login HTML as JSON/JS and throw console errors.
  //
  // `/manifest.webmanifest` and `/icon`, `/apple-icon` are served by Next
  // 16's app/manifest.ts + app/icon.tsx + app/apple-icon.tsx respectively.
  const publicStaticPaths = [
    "/manifest.webmanifest",
    "/sw.js",
    "/icon",
    "/apple-icon",
    "/favicon.ico",
    "/robots.txt",
  ];
  const isPublicRoute =
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
