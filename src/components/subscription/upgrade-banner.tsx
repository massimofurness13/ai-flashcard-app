"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  openStripeCheckout,
  prepareStripeCheckout,
} from "@/lib/stripe-checkout";

export function UpgradeBanner({ feature = "this feature" }: { feature?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    // Synchronous popup BEFORE any await — keeps the browser
    // treating this as a user-initiated open. Without this step,
    // popup blockers silently swallow the open after the fetch
    // resolves and the upgrade button looks dead.
    const prepared = prepareStripeCheckout();
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        openStripeCheckout(data.url, prepared);
        setLoading(false);
        return;
      }
      // No URL came back — close the empty tab so the user doesn't
      // see a phantom about:blank window, then fall through to
      // pricing so they can pick a plan manually.
      prepared?.close();
    } catch {
      prepared?.close();
    }
    setLoading(false);
    router.push("/pricing");
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
      <div className="text-3xl">{"✨"}</div>
      <h3 className="font-editorial text-xl font-medium">Unlock {feature}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        This feature is available with a Pro subscription. Upgrade for just $8.99/month and enjoy the full Huella experience.
      </p>
      <div className="flex gap-2 justify-center">
        <Button onClick={handleUpgrade} disabled={loading}>
          {loading ? "Loading..." : "Upgrade to Pro"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/pricing")}>
          See Plans
        </Button>
      </div>
    </div>
  );
}
