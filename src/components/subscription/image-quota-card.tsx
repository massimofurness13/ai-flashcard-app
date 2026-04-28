"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QuotaState } from "@/lib/image-quota";
import { formatRelativeDate } from "@/lib/utils";
import { CREDIT_BUNDLES } from "./quota-exceeded-dialog";
import { openStripeCheckout } from "@/lib/stripe-checkout";

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
        openStripeCheckout(data.url);
        setPurchasing(null);
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

  const resetLabel = quota.resetAt
    ? formatRelativeDate(quota.resetAt)
    : "when your subscription renews";
  const progressPct =
    quota.monthlyLimit > 0
      ? Math.min((quota.monthlyUsed / quota.monthlyLimit) * 100, 100)
      : 0;
  const totalCredits = quota.monthlyRemaining + quota.credits;
  const quickCount = totalCredits;
  const premiumCount = Math.floor(totalCredits / 5);

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
                <span className="font-medium">Monthly allowance</span>
                <span className="text-muted-foreground">
                  {quota.monthlyUsed} / {quota.monthlyLimit} credits used
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

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium mb-1">You currently have enough for:</p>
              <p className="text-muted-foreground">
                ✨ up to <span className="text-foreground font-medium">{quickCount.toLocaleString()}</span> Quick images
              </p>
              <p className="text-muted-foreground">
                🎨 up to <span className="text-foreground font-medium">{premiumCount.toLocaleString()}</span> Premium images
              </p>
              {quota.credits > 0 && (
                <p className="text-xs text-muted-foreground pt-1">
                  Includes {quota.credits} purchased credits (never expire)
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground leading-relaxed space-y-2">
              <p className="font-medium text-foreground text-sm">
                Quick ✨ vs Premium 🎨
              </p>
              <p>
                <span className="text-foreground font-medium">Quick</span>{" "}
                images cost 1 credit each — clean and simple. They&apos;re
                fine if you&apos;re running out of credits and want to
                populate packs quickly and cheaply.
              </p>
              <p>
                That said, we&apos;d definitely recommend{" "}
                <span className="text-foreground font-medium">Premium</span>{" "}
                (5 credits each). They&apos;re much higher quality and way
                more memorable — and memorable is the whole point. If
                you&apos;re serious about your learning and want cards that
                actually stick in your mind, Premium is what we&apos;d pick.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Top up anytime</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generating great AI images is genuinely expensive — each
                  one is a real render — but once your pack is illustrated,
                  those images are yours forever. And unlike the monthly
                  Pro allowance, top-up credits never expire.
                </p>
              </div>
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
                        {bundle.amount.toLocaleString()}
                      </span>
                      {bundle.popular && (
                        <span className="text-[9px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-1 py-0.5 rounded">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">credits</p>
                    <p className="font-bold text-sm mt-1">
                      {purchasing === bundle.id ? "..." : bundle.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {bundle.perCredit} per credit
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                      {bundle.affords}
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
              <span className="font-semibold">{quota.lifetimeFreeRemaining}</span>{" "}
              free credits to try AI images.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upgrade to Pro for 500 AI image credits every month — up to 500
              Quick ✨ images or 100 Premium 🎨 images, plus unlimited AI text
              generation and Anki import/export.
            </p>
            <Button
              size="sm"
              onClick={async () => {
                const res = await fetch("/api/stripe/checkout", { method: "POST" });
                const data = await res.json();
                if (data.url) openStripeCheckout(data.url);
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
