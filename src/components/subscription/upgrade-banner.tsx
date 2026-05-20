"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Inline upsell shown wherever a Pro feature is reached on a free
 * plan. The CTA routes to /pricing so the user can compare Monthly
 * vs Yearly before Stripe ever enters the picture.
 *
 * The previous version fired a Stripe checkout directly with
 * `plan: "monthly"` assumed, which short-circuited the comparison
 * and made the yearly plan (the recommended one) harder to discover.
 * Pricing page handles the actual purchase, with the popup-blocker
 * fix from src/lib/stripe-checkout.ts.
 */
export function UpgradeBanner({ feature = "this feature" }: { feature?: string }) {
  const router = useRouter();

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
      <div className="text-3xl">{"✨"}</div>
      <h3 className="font-editorial text-xl font-medium">Unlock {feature}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Available on Pro — from $6.67/month on yearly (3 months free)
        or $8.99/month. Pick the plan that fits.
      </p>
      <div className="flex gap-2 justify-center">
        <Button onClick={() => router.push("/pricing")}>
          See plans
        </Button>
      </div>
    </div>
  );
}
