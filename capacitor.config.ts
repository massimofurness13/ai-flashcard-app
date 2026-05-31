import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config — wraps the live Huella web app in a native iOS
 * shell.
 *
 * Architecture: Huella is a server-rendered Next.js app (server
 * components, API routes, Supabase SSR auth), so it can't be exported
 * as static files and bundled. Instead the native WebView loads the
 * live deployment directly via `server.url`. The native app is a thin
 * shell + native plugins (status bar, splash, push later); the actual
 * UI is served from the same place the website is.
 *
 * `webDir` points at a tiny offline fallback page that only shows if
 * the device can't reach the server at launch.
 *
 * IAP note: Stripe checkout opens in the EXTERNAL browser (see
 * src/lib/stripe-checkout.ts), not inside this WebView, which is what
 * keeps Apple's 30% commission out of the loop.
 *
 * To point at a real custom domain later: change `server.url` here,
 * add the domain in Render, and `npx cap sync ios`.
 */
const SERVER_URL = "https://flashmind-35q4.onrender.com";

const config: CapacitorConfig = {
  // Reverse-DNS bundle identifier. Matches the eventual huella.app
  // domain. This is registered in App Store Connect on first submit
  // and is effectively permanent, so we lock it in now.
  appId: "app.huella",
  appName: "Huella",
  webDir: "mobile/fallback",
  server: {
    url: SERVER_URL,
    // HTTPS only — never allow cleartext traffic.
    cleartext: false,
  },
  ios: {
    // "always" keeps web content below the status bar so the top
    // nav isn't hidden under the clock/battery. The web app handles
    // the bottom safe area via its own layout. (We can revisit
    // edge-to-edge once the web side reads env(safe-area-inset-*).)
    contentInset: "always",
    // System background while the WebView boots → no white flash
    // before Huella's dark theme paints.
    backgroundColor: "#0f0d0a",
  },
  plugins: {
    SplashScreen: {
      // IMPORTANT: auto-hide must be TRUE. The remote web app doesn't
      // bundle @capacitor/core, so it can't call SplashScreen.hide()
      // itself — if we left auto-hide off, the splash would stay up
      // forever and the app would look frozen. Show it briefly while
      // the live site loads, then fade out.
      launchAutoHide: true,
      launchShowDuration: 1500,
      launchFadeOutDuration: 300,
      backgroundColor: "#0f0d0a",
      showSpinner: false,
    },
  },
};

export default config;
