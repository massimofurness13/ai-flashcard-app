"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  openStripeCheckout,
  dismissPreparedCheckout,
  prepareStripeCheckout,
} from "@/lib/stripe-checkout";

interface AccountInfo {
  createdAt: string | null;
  lastSyncAt: string | null;
  isPro: boolean;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    hasStripeCustomer: boolean;
  } | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDate(iso);
}

/**
 * Trust-building stats block: member-since date + live sync status +
 * subscription state with the appropriate action (Upgrade / Manage).
 */
export function AccountInfoCard() {
  const router = useRouter();
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  // "Upgrade to Pro" now sends the user to /pricing instead of
  // firing checkout with monthly assumed. They get to see Monthly
  // vs Yearly side-by-side (yearly is the recommended plan with
  // 6,000 credits unlocked upfront) before Stripe enters the
  // picture. Pricing page handles the actual checkout.

  async function handleManage() {
    // Stripe Customer Portal also opens externally — same IAP
    // rationale, same popup-blocker fix.
    const prepared = prepareStripeCheckout();
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        openStripeCheckout(data.url, prepared);
      } else {
        dismissPreparedCheckout(prepared, `${window.location.origin}/pricing`);
        alert(data.error || "Could not open the billing portal.");
      }
    } catch {
      dismissPreparedCheckout(prepared, `${window.location.origin}/pricing`);
      alert("Could not open the billing portal.");
    } finally {
      setLoading(false);
    }
  }

  if (!info) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  const renewalDate = info.subscription?.currentPeriodEnd;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Member since
            </p>
            <p className="text-sm font-medium mt-1">
              {formatDate(info.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Sync status
            </p>
            <p className="text-sm font-medium mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              {formatSyncTime(info.lastSyncAt)}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-border space-y-2">
          {info.isPro ? (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-medium flex items-center gap-1.5">
                    <span className="text-xs font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                      PRO
                    </span>
                    Huella Pro
                  </p>
                  {renewalDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Renews {formatDate(renewalDate)}
                    </p>
                  )}
                </div>
                {info.subscription?.hasStripeCustomer && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManage}
                    disabled={loading}
                  >
                    Manage
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-medium">Free Plan</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pick a plan to get more AI image credits and keep your
                  illustrations visible past the 30-day trial.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => router.push("/pricing")}
                disabled={loading}
              >
                See plans
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
