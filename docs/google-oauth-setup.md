# Google OAuth Setup — one-time checklist

The "Continue with Google" buttons are now live in the code. To make them actually work, Google OAuth needs to be configured in two places: Google Cloud Console, then Supabase. This takes about 10 minutes end-to-end.

## Step 1 — Google Cloud Console (create OAuth credentials)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with the Google account that will own the OAuth app (use a long-term account, not a throwaway)
3. **Create a new project** (top-left dropdown → "New Project")
   - Name it `FlashMind` (or whatever)
4. In the left sidebar: **APIs & Services → OAuth consent screen**
   - User Type: **External** (unless you have a Google Workspace org)
   - App name: `FlashMind`
   - User support email: your email
   - App logo: optional but nice — upload your FlashMind icon (512×512)
   - Application home page: `https://flashmind-35q4.onrender.com`
   - Authorized domains: add `onrender.com` and `supabase.co`
   - Developer contact email: your email
   - Save and continue through "Scopes" (no changes needed) and "Test users" (add your own email so you can test before publishing)
   - Back on the summary page, click **"Publish app"** to move out of testing mode — otherwise only test users can sign in

5. Sidebar: **APIs & Services → Credentials**
   - Click **"Create credentials" → "OAuth client ID"**
   - Application type: **Web application**
   - Name: `FlashMind web`
   - **Authorized JavaScript origins** — add both:
     - `https://flashmind-35q4.onrender.com`
     - `https://fghxwycixcawwtctknmp.supabase.co`
   - **Authorized redirect URIs** — add exactly this (copy-paste, it's what Supabase expects):
     - `https://fghxwycixcawwtctknmp.supabase.co/auth/v1/callback`
   - Click **Create**

6. A dialog pops up with your **Client ID** and **Client Secret**. Copy both — you'll paste them into Supabase next.

## Step 2 — Supabase dashboard

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your FlashMind project
2. Sidebar: **Authentication → Providers**
3. Find **Google** in the list, click to expand
4. Toggle **Enable Sign in with Google** to ON
5. Paste:
   - **Client ID (for OAuth)** — the client ID from Google
   - **Client Secret (for OAuth)** — the client secret from Google
6. Leave "Skip nonce checks" OFF (default)
7. Click **Save**

## Step 3 — Test it

1. Visit `https://flashmind-35q4.onrender.com/auth/login`
2. Click "Continue with Google"
3. Pick your Google account → approve the permission prompt
4. You should land on the home page, signed in

If it fails:

- **"redirect_uri_mismatch"** — the URI in Google Cloud doesn't exactly match what Supabase sends. Double-check `https://fghxwycixcawwtctknmp.supabase.co/auth/v1/callback` is in the Authorized redirect URIs list.
- **"This app isn't verified"** — normal for a new Google OAuth app; click "Advanced" → "Go to FlashMind (unsafe)" to bypass for testing. For production, Google requires a verification process (~1 week) if you add sensitive scopes, but the basic `email` + `profile` scopes don't need verification.
- **"provider is not enabled"** — you didn't save in Supabase, or saved without the Client ID/Secret.

## What happens on first Google sign-in

Supabase auto-creates a user with the Google-provided email, full name, and avatar URL. Our schema's `User` row is upserted via the existing `ensureUser()` flow on the next page load, so everything downstream (subscriptions, quota, etc.) just works.

No changes needed to our database. No changes needed to any API route.

## Revoking or rotating

If the Google Client Secret is ever leaked:
1. Google Cloud Console → Credentials → click the OAuth client → Reset Secret
2. Paste the new secret into Supabase → Providers → Google → Save

Users stay signed in across rotation (existing tokens are valid for their remaining lifetime).
