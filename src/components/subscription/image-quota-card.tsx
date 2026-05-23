"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QuotaState } from "@/lib/image-quota";
import { formatRelativeDate } from "@/lib/utils";
import { CREDIT_BUNDLES } from "./quota-exceeded-dialog";
import {
  openStripeCheckout,
  dismissPreparedCheckout,
  prepareStripeCheckout,
} from "@/lib/stripe-checkout";

export function ImageQuotaCard() {
  const router = useRouter();
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
    // Pre-open the tab inside the user gesture — popup-blocker fix.
    const prepared = prepareStripeCheckout();
    setPurchasing(bundle);
    try {
      const res = await fetch("/api/stripe/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle }),
      });
      const data = await res.json();
      if (data.url) {
        openStripeCheckout(data.url, prepared);
      } else {
        dismissPreparedCheckout(prepared, `${window.location.origin}/pricing`);
        alert(data.error || "Could not start checkout.");
      }
    } catch {
      dismissPreparedCheckout(prepared, `${window.location.origin}/pricing`);
      alert("Network error.");
    } finally {
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

            <p className="text-xs text-muted-foreground">
              Enough for{" "}
              <span className="text-foreground font-medium">
                ~{premiumCount.toLocaleString()} Premium
              </span>{" "}
              or{" "}
              <span className="text-foreground font-medium">
                {quickCount.toLocaleString()} Quick
              </span>{" "}
              images
              {quota.credits > 0 && (
                <>
                  {" "}
                  · includes {quota.credits} purchased credits (never expire)
                </>
              )}
              .
            </p>

            <div className="space-y-2">
              <p className="text-sm font-medium">Top up</p>
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

            {quota.plan === "monthly" && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-muted-foreground leading-snug min-w-0 flex-1">
                  <span className="font-medium text-foreground">
                    Switch to yearly
                  </span>{" "}
                  · all 6,000 credits unlocked upfront, ~3 months free
                </p>
                <Button
                  size="sm"
                  onClick={async () => {
                    const prepared = prepareStripeCheckout();
                    try {
                      const res = await fetch("/api/stripe/checkout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ plan: "yearly" }),
                      });
                      const data = await res.json();
                      if (data.url) {
                        openStripeCheckout(data.url, prepared);
                      } else {
                        dismissPreparedCheckout(prepared, `${window.location.origin}/pricing`);
                        alert(data.error || "Could not start checkout.");
                      }
                    } catch {
                      dismissPreparedCheckout(prepared, `${window.location.origin}/pricing`);
                      alert("Could not start checkout. Please try again.");
                    }
                  }}
                >
                  Switch to yearly — $79.99
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              You have{" "}
              <span className="font-semibold">{quota.lifetimeFreeRemaining}</span>{" "}
              free credits to try AI images.
            </p>
            <Button size="sm" onClick={() => router.push("/pricing")}>
              See plans
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
