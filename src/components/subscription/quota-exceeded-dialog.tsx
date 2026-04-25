"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuotaState } from "@/lib/image-quota";
import { formatRelativeDate } from "@/lib/utils";
import { openStripeCheckout } from "@/lib/stripe-checkout";

interface CreditBundle {
  id: string;
  amount: number;
  priceCents: number;
  label: string;
  perCredit: string;
  popular?: boolean;
}

export const CREDIT_BUNDLES: CreditBundle[] = [
  { id: "500", amount: 500, priceCents: 499, label: "$4.99", perCredit: "1¢" },
  { id: "1500", amount: 1500, priceCents: 1199, label: "$11.99", perCredit: "0.8¢", popular: true },
  { id: "5000", amount: 5000, priceCents: 3499, label: "$34.99", perCredit: "0.7¢" },
];

interface QuotaExceededDialogProps {
  open: boolean;
  quota: QuotaState | null;
  onClose: () => void;
}

export function QuotaExceededDialog({ open, quota, onClose }: QuotaExceededDialogProps) {
  const [purchasing, setPurchasing] = useState<string | null>(null);

  if (!open || !quota) return null;

  async function handleBuy(bundle: string) {
    setPurchasing(bundle);
    try {
      const res = await fetch("/api/stripe/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle }),
      });
      const data = await res.json();
      if (data.url) {
        openStripeCheckout(data.url);
        setPurchasing(null);
      } else {
        alert(data.error || "Could not start checkout. Please try again.");
        setPurchasing(null);
      }
    } catch {
      alert("Network error. Please try again.");
      setPurchasing(null);
    }
  }

  const resetLabel = quota.resetAt
    ? formatRelativeDate(quota.resetAt)
    : "when your subscription renews";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="text-3xl">{"\u2728"}</div>
          <h2 className="text-xl font-bold">You&apos;ve used all your image credits</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You can either wait until {resetLabel} when your credits refresh, or
            top up now. Credits never expire and stack with your monthly allowance.
          </p>
        </div>

        <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Monthly credits</span>
            <span className="font-medium">
              {quota.monthlyUsed} / {quota.monthlyLimit} used
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Extra credits</span>
            <span className="font-medium">{quota.credits}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Refreshes</span>
            <span className="font-medium">{resetLabel}</span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Top up your credits</p>
          <div className="grid gap-2">
            {CREDIT_BUNDLES.map((bundle) => (
              <button
                key={bundle.id}
                type="button"
                onClick={() => handleBuy(bundle.id)}
                disabled={purchasing !== null}
                className={`group flex items-center justify-between w-full rounded-lg border p-3 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  bundle.popular
                    ? "border-primary bg-primary/10 hover:bg-primary/15"
                    : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{bundle.amount.toLocaleString()} credits</span>
                    {bundle.popular && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                        Best value
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {bundle.amount.toLocaleString()} Quick ✨ images, or{" "}
                    {Math.floor(bundle.amount / 5).toLocaleString()} Premium 🎨 images
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">
                    {purchasing === bundle.id ? "..." : bundle.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {bundle.perCredit} per credit
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
