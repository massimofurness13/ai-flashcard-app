"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuotaState } from "@/lib/image-quota";
import { formatRelativeDate } from "@/lib/utils";

interface CreditBundle {
  id: string;
  amount: number;
  priceCents: number;
  label: string;
  perImage: string;
  popular?: boolean;
}

export const CREDIT_BUNDLES: CreditBundle[] = [
  { id: "100", amount: 100, priceCents: 499, label: "$4.99", perImage: "5¢" },
  { id: "300", amount: 300, priceCents: 1199, label: "$11.99", perImage: "4¢", popular: true },
  { id: "1000", amount: 1000, priceCents: 3499, label: "$34.99", perImage: "3.5¢" },
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
        window.location.href = data.url;
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
    : "next month";

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
          <div className="text-3xl">{"\ud83d\ude4f"}</div>
          <h2 className="text-xl font-bold">You&apos;ve used all your AI images this month</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We&apos;re really sorry for the cap. AI image generation is expensive today
            (each image costs us real money), so we have to limit how many you can
            make per month to keep FlashMind affordable. As AI prices drop over the
            next year or two, we&apos;ll pass those savings on to you and raise these
            limits. Thanks for your patience.
          </p>
        </div>

        <div className="rounded-lg bg-muted p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">This month</span>
            <span className="font-medium">
              {quota.monthlyUsed} / {quota.monthlyLimit} used
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-muted-foreground">Extra credits</span>
            <span className="font-medium">{quota.credits}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-muted-foreground">Monthly refresh</span>
            <span className="font-medium">{resetLabel}</span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">You have two options:</p>
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">Wait until {resetLabel}</p>
            <p className="text-muted-foreground mt-0.5">
              Your allowance refreshes automatically. You can keep using your cards
              without images in the meantime — they still work great for study.
            </p>
          </div>
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-3">
            <div>
              <p className="font-medium">Or top up your credits now</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Credits never expire and stack with your monthly allowance.
              </p>
            </div>
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
                      <span className="font-semibold">{bundle.amount} images</span>
                      {bundle.popular && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                          Best value
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {bundle.perImage} each
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {purchasing === bundle.id ? "..." : bundle.label}
                    </p>
                  </div>
                </button>
              ))}
            </div>
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
