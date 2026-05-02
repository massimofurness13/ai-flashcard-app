"use client";

/**
 * PostHog product analytics — pageviews, heatmaps, session replay,
 * funnels. Initialised client-side on first mount; capture is opt-in
 * via env vars so local dev never burns quota and a missing key on
 * Render never breaks the app.
 *
 * Pageview tracking is manual: PostHog's auto-pageview only fires on
 * full reloads, which misses every SPA route change in App Router.
 * We listen to `usePathname()` + `useSearchParams()` and emit a
 * `$pageview` ourselves on each transition.
 *
 * Identify on auth: when Supabase reports a user, we call
 * `posthog.identify(userId, { email })` so events stitch back to
 * a person. On sign-out we call `posthog.reset()` so the next
 * session starts as anonymous (and doesn't accidentally merge two
 * users on a shared device).
 */

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { createClient } from "@/lib/supabase/client";

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    // Build the URL the same way PostHog's auto-pageview would, so
    // session replay + pageview events line up on the same path.
    let url = window.origin + pathname;
    const search = searchParams?.toString();
    if (search) url = `${url}?${search}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

function AuthIdentifier() {
  useEffect(() => {
    const supabase = createClient();

    // Identify on initial session read so we don't lose the user
    // between hard refreshes.
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (user) {
        posthog.identify(user.id, { email: user.email });
      }
    });

    // Then keep in sync with sign-in / sign-out / token-refresh.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          posthog.reset();
          return;
        }
        const user = session?.user;
        if (user) {
          posthog.identify(user.id, { email: user.email });
        }
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  useEffect(() => {
    if (!key) return;
    if (posthog.__loaded) return;
    posthog.init(key, {
      api_host: host,
      // Only create a person profile once we've identified the user,
      // so anonymous traffic doesn't bloat the MAU count.
      person_profiles: "identified_only",
      // We capture pageviews manually below to handle SPA transitions.
      capture_pageview: false,
    });
  }, [key, host]);

  // No key → render children untouched. This is the local-dev path
  // and the "env var forgotten on Render" path; both should still
  // boot the app cleanly.
  if (!key) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      {/* useSearchParams must live inside a Suspense boundary so the
       * route's static prerender doesn't bail. Tracker renders nothing
       * either way, so an empty fallback is fine. */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <AuthIdentifier />
      {children}
    </PHProvider>
  );
}
