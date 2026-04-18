"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QuotaState } from "@/lib/image-quota";
import { formatRelativeDate } from "@/lib/utils";
import { CREDIT_BUNDLES } from "./quota-exceeded-dialog";

export function ImageQuotaCard() {
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/images/quota")
      .then((res) => res.json())
      .then((data) => {
        setQuota(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
        alert(data.error || "Could not start checkout.");
        setPurchasing(null);
      }
    } catch {
      alert("Network error.");
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Image Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  if (!quota) return null;

  const resetLabel = quota.resetAt ? formatRelativeDate(quota.resetAt) : "next month";
  const progressPct =
    quota.monthlyLimit > 0
      ? Math.min((quota.monthlyUsed / quota.monthlyLimit) * 100, 100)
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Image Credits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {quota.isPro ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">This month</span>
                <span className="text-muted-foreground">
                  {quota.monthlyUsed} / {quota.monthlyLimit} images used
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Refreshes {resetLabel}
              </p>
            </div>

            {quota.credits > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-medium">
                  ✨ {quota.credits} extra credits available
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Credits never expire and are used after your monthly allowance.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-border p-3 space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground text-sm">
                Why the limit?
              </p>
              <p className="leading-relaxed">
                We&apos;re really sorry for the cap. AI image generation is expensive
                today — each image costs us real money, so we have to limit how many
                you can make per month to keep FlashMind affordable. As AI prices
                drop over the next year or two, we&apos;ll pass those savings on to
                you and raise these limits. Thank you for your patience.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Top up your credits</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {CREDIT_BUNDLES.map((bundle) => (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => handleBuy(bundle.id)}
                    disabled={purchasing !== null}
                    className={`rounded-lg border p-3 text-left transition-all cursor-pointer disabled:opacity-50 ${
                      bundle.popular
                        ? "border-primary bg-primary/10 hover:bg-primary/15"
                        : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">
                        {bundle.amount}
                      </span>
                      {bundle.popular && (
                        <span className="text-[9px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-1 py-0.5 rounded">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">images</p>
                    <p className="font-bold text-sm mt-1">
                      {purchasing === bundle.id ? "..." : bundle.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {bundle.perImage} per image
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              You have{" "}
              <span className="font-semibold">
                {quota.lifetimeFreeRemaining}
              </span>{" "}
              free AI image{quota.lifetimeFreeRemaining === 1 ? "" : "s"} remaining
              on the free plan.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upgrade to Pro for 150 AI images every month, plus unlimited AI text
              generation and Anki import/export.
            </p>
            <Button
              size="sm"
              onClick={async () => {
                const res = await fetch("/api/stripe/checkout", { method: "POST" });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              }}
            >
              Upgrade to Pro
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
