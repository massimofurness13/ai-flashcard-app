"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number): string {
  const am = h < 12;
  const twelveH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${twelveH}:00 ${am ? "AM" : "PM"}`;
}

// Convert a VAPID public key string (base64url) to an ArrayBuffer the
// PushSubscriptionOptions.applicationServerKey field expects. We return
// ArrayBuffer (not Uint8Array) so the type matches BufferSource without
// fighting SharedArrayBuffer variance.
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

type Status =
  | "loading"
  | "unsupported"
  | "denied"
  | "disabled"
  | "enabled";

/**
 * Daily study reminder — toggle + hour picker + test button.
 *
 * Permission + service worker + push subscription are set up lazily
 * when the user flips the toggle on, so we don't pester anyone until
 * they actually want reminders.
 */
export function ReminderCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [hour, setHour] = useState<number>(20);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    const perm = Notification.permission;
    if (perm === "denied") {
      setStatus("denied");
    }

    // Hydrate the saved reminder time from the server
    fetch("/api/user/reminder")
      .then((r) => r.json())
      .then((data: { reminderHour: number | null }) => {
        if (data.reminderHour !== null && data.reminderHour !== undefined) {
          setHour(data.reminderHour);
          if (perm === "granted") setStatus("enabled");
          else setStatus("disabled");
        } else {
          setStatus("disabled");
        }
      })
      .catch(() => setStatus("disabled"));
  }, []);

  async function enable() {
    setSaving(true);
    setMessage(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "disabled");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setMessage("Server not configured for push (missing VAPID key).");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(publicKey),
        }));

      const raw = sub.toJSON() as {
        endpoint: string;
        keys?: { p256dh?: string; auth?: string };
      };

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: raw.endpoint,
          keys: raw.keys,
          userAgent: navigator.userAgent,
        }),
      });

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await fetch("/api/user/reminder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hour, timezone }),
      });

      setStatus("enabled");
      setMessage("Reminders on. We'll nudge you once a day.");
    } finally {
      setSaving(false);
    }
  }

  async function disable() {
    setSaving(true);
    setMessage(null);
    try {
      await fetch("/api/user/reminder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hour: null }),
      });

      // Also clean up the browser subscription so the push service stops
      // routing packets we'll now ignore server-side.
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const existing = await reg?.pushManager.getSubscription();
        if (existing) {
          await existing.unsubscribe();
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: existing.endpoint }),
          });
        }
      }

      setStatus("disabled");
    } finally {
      setSaving(false);
    }
  }

  async function updateHour(nextHour: number) {
    setHour(nextHour);
    if (status !== "enabled") return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await fetch("/api/user/reminder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hour: nextHour, timezone }),
    });
  }

  async function sendTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Test sent to ${data.sent} device${data.sent === 1 ? "" : "s"}.`);
      } else {
        setMessage(data.error || "Test failed.");
      }
    } finally {
      setTesting(false);
    }
  }

  if (status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily reminder</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "unsupported") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily reminder</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your browser doesn&apos;t support push notifications. On iPhone,
            add Huella to your home screen to enable them.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "denied") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily reminder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Notifications are blocked for this site. Enable them in your
            browser settings and reload.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily reminder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Nudge yourself to study every day. We&apos;ll skip the reminder if
          you&apos;ve already hit your goal.
        </p>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {status === "enabled"
                ? `On — ${formatHour(hour)}`
                : "Off"}
            </p>
          </div>
          {status === "enabled" ? (
            <Button variant="outline" size="sm" onClick={disable} disabled={saving}>
              Turn off
            </Button>
          ) : (
            <Button size="sm" onClick={enable} disabled={saving}>
              {saving ? "Enabling…" : "Turn on"}
            </Button>
          )}
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Reminder time</label>
          <select
            value={hour}
            onChange={(e) => updateHour(parseInt(e.target.value, 10))}
            className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>

        {status === "enabled" && (
          <Button
            variant="outline"
            size="sm"
            onClick={sendTest}
            disabled={testing}
          >
            {testing ? "Sending…" : "Send test notification"}
          </Button>
        )}

        {message && (
          <p className="text-xs text-muted-foreground">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
