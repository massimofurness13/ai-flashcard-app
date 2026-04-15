"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UpgradeBanner({ feature = "this feature" }: { feature?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {}
    setLoading(false);
    router.push("/pricing");
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
      <div className="text-3xl">{"🔒"}</div>
      <h3 className="text-lg font-semibold">Pro Feature</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Upgrade to Pro to unlock {feature}. Just $6.99/month.
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
