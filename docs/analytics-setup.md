# Analytics setup — PostHog

Huella ships with PostHog wired up for product analytics: pageviews, heatmaps, session replay, and funnels. The integration is dormant until two env vars are set, so local dev never burns quota and a missing key on Render won't break the app.

## One-time setup

### 1. Create a PostHog account

1. Go to <https://posthog.com> and sign up. Free tier: 1M events/mo + 5,000 session replays/mo. **No credit card required.**
2. Pick a region at signup — **US cloud** (`https://us.i.posthog.com`) or **EU cloud** (`https://eu.i.posthog.com`). This is permanent per project, so pick whichever matches where most of your users are.
3. Create a project (e.g. `huella-prod`).

### 2. Grab the keys

In the PostHog dashboard:

- **Project Settings → Project API Key** — copy the value. This is your `NEXT_PUBLIC_POSTHOG_KEY`. It's a write-only ingestion key, safe to expose in the browser.
- The host URL is whichever region you picked: `https://us.i.posthog.com` or `https://eu.i.posthog.com`.

### 3. Set them on Render

In the Render dashboard for the Huella service → **Environment**, add:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_...` (from step 2) |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` *or* `https://eu.i.posthog.com` |

Save. Render will redeploy. Within a couple of minutes you'll see live events in the PostHog dashboard under **Activity**.

## What's already wired up

- **Pageviews** — every SPA route change emits a `$pageview`. We track `usePathname` + `useSearchParams` ourselves because PostHog's auto-capture only fires on hard reloads, which misses every client-side transition in App Router.
- **Identify** — when a Supabase session is detected, we call `posthog.identify(userId, { email })`. On sign-out we call `posthog.reset()`. Anonymous traffic doesn't create a person profile (`person_profiles: 'identified_only'`), so casual landing-page visitors don't bloat your MAU.
- **Heatmaps + autocapture** — enabled by default. PostHog captures clicks, scrolls, form interactions automatically. No code needed.

## Turning on the rest in PostHog

Most of these are dashboard-only switches. No code changes.

### Session replay

1. PostHog dashboard → **Session Replay** (left sidebar) → **Configure**.
2. Toggle **Record user sessions** on.
3. Free tier: 5,000 recordings/mo. Recordings auto-expire after 1 month on the free plan.
4. Privacy: by default PostHog masks all `<input type="password">` and any element with `data-private` or class `ph-no-capture`. If we ever render PII (full email, payment details) outside a password input, slap `class="ph-no-capture"` on it.

### Heatmaps

1. PostHog dashboard → **Heatmaps** tab.
2. Paste the URL of any page (e.g. `https://huella.app/` or `/study`). PostHog overlays click density on the live page using the autocapture data it already collected. No tagging required.

### Funnels

1. PostHog dashboard → **Insights → New insight → Funnel**.
2. Pick events in order, e.g. `$pageview` (`/`), `$pageview` (`/auth/signup`), `$autocapture` (Sign Up button), `$pageview` (`/decks`).
3. Save to a dashboard.

### A/B testing (Experiments)

PostHog **Experiments** is on the free tier. To wire one up:

1. Dashboard → **Experiments → New experiment**. Define a feature flag key, variants, and a primary metric (e.g. `signup_completed`).
2. In code, gate the variant with `posthog.getFeatureFlag('flag-key')` from the `posthog-js` client. The provider already exposes `posthog` via `usePostHog()` from `posthog-js/react`.

Example:

```tsx
"use client";
import { usePostHog } from "posthog-js/react";

export function HeadlineExperiment() {
  const posthog = usePostHog();
  const variant = posthog?.getFeatureFlag("landing-headline-v1");

  if (variant === "memory-led") return <h1>Built for the way memory works.</h1>;
  return <h1>Memorize vocabulary 6× faster.</h1>;
}
```

## Local development

Leave `NEXT_PUBLIC_POSTHOG_KEY` blank in your local `.env`. The provider short-circuits when the key is missing — no events fire, no quota burned, no console noise.

If you ever want to test the PostHog wiring locally, set the key + host in `.env` and watch the **Activity** feed in the PostHog dashboard while clicking around.

## Files involved

- `src/components/posthog-provider.tsx` — the client provider, pageview tracker, and auth identifier.
- `src/app/layout.tsx` — mounts the provider around the app tree.
- `.env.example` — documents both env vars.
