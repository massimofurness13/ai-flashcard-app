import webpush from "web-push";

/**
 * Server-side web-push wrapper. Configured lazily from env vars so a
 * missing VAPID key doesn't crash the app at import time — only when
 * sendPush() is actually called.
 *
 * Required env:
 *   VAPID_PUBLIC_KEY   — also exposed to the client as NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY  — server-only
 *   VAPID_SUBJECT      — "mailto:you@example.com" or an https URL
 */
let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@flashmind.app";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPush(
  subscription: {
    endpoint: string;
    p256dhKey: string;
    authKey: string;
  },
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; gone: boolean; error: unknown }> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dhKey,
          auth: subscription.authKey,
        },
      },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (err: unknown) {
    // 410 Gone / 404 = subscription is dead, caller should delete it
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    const gone = statusCode === 404 || statusCode === 410;
    return { ok: false, gone, error: err };
  }
}
