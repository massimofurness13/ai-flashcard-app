"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickPremiumComparison } from "@/components/subscription/quick-premium-comparison";
import { APP_NAME } from "@/lib/constants";
import { openStripeCheckout } from "@/lib/stripe-checkout";

type Plan = "monthly" | "yearly";

// Feature buckets ordered for skimming, not for selling. Lift any
// line up if user research shows it's the conversion driver.
const FREE_FEATURES = [
  "Unlimited decks and cards",
  "AI-powered card generation from any text",
  "Spaced repetition with proven SM-2 algorithm",
  "Progress tracking and mastery statistics",
  "Anki .apkg import and export — no lock-in",
  "Upload your own images to cards",
  "Text-to-speech with native voices in 9+ languages",
  "25 AI image credits + 30-day viewing window",
  "Light and dark themes",
];

// What you actually pay for. Everything in Free works on Pro too —
// the differentiator is the image allowance and the indefinite
// viewing entitlement.
const PRO_FEATURES = [
  "Everything in Free, plus:",
  "AI illustrations stay visible forever (no 30-day blur)",
  "Generate from any pack, any time",
  "Priority support from our team",
];

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<Plan | null>(null);

  async function handleUpgrade(plan: Plan) {
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        openStripeCheckout(data.url);
      } else {
        alert(data.error || "Could not start checkout. Please try again.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    }
    setLoading(null);
  }

  // Maths the user benefits from seeing. Yearly is the same per-month
  // headline a Pro user pays divided across 12 months, plus the bulk
  // credits — that's the story we want to lead with.
  const YEARLY_TOTAL = 79.99;
  const MONTHLY_PRICE = 8.99;
  const YEARLY_EQUIV_PER_MONTH = (YEARLY_TOTAL / 12).toFixed(2); // "6.67"
  const YEARLY_SAVINGS = (MONTHLY_PRICE * 12 - YEARLY_TOTAL).toFixed(2); // "27.89"
  const YEARLY_SAVINGS_PCT = Math.round(
    ((MONTHLY_PRICE * 12 - YEARLY_TOTAL) / (MONTHLY_PRICE * 12)) * 100,
  ); // 26

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-10">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <h1 className="font-editorial text-3xl font-medium sm:text-4xl">
          {APP_NAME} pricing
        </h1>
        <p className="text-muted-foreground">
          Start for free. Upgrade when you&apos;re ready to illustrate at scale.
        </p>
      </div>

      {/*
        Three-column lineup. Yearly is the recommended plan: same
        total credits as a year of monthly (500 × 12 = 6,000) but
        ALL unlocked on day one, so a user migrating from Anki or
        bulk-generating a whole library doesn't have to wait twelve
        billing cycles. That's the conversion story; the card itself
        is widened, ringed in primary, and lifted with a "Best
        value" eyebrow chip.

        Mobile order intentionally puts Yearly first (most important
        recommendation), then Monthly, then Free at the bottom. On
        desktop the visual order is Free → Monthly → Yearly so the
        eye walks left-to-right into the recommended pick.
      */}
      <div className="grid gap-6 md:grid-cols-3 md:items-start">
        {/* ── Yearly Pro — featured ─────────────────────────────── */}
        <Card className="order-1 md:order-3 border-2 border-primary relative overflow-visible md:scale-[1.02] shadow-xl">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow whitespace-nowrap">
            ⭐ Best value · Save ${YEARLY_SAVINGS}/yr
          </div>
          <CardHeader className="pt-6">
            <CardTitle className="flex items-baseline justify-between gap-2">
              <span className="font-editorial text-xl">Pro · Yearly</span>
              <div className="text-right">
                <span className="font-editorial text-2xl">
                  ${YEARLY_EQUIV_PER_MONTH}
                </span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              ${YEARLY_TOTAL.toFixed(2)} billed once a year — ~{YEARLY_SAVINGS_PCT}% off monthly
            </p>
          </CardHeader>
          <CardContent>
            {/* The whole reason yearly exists: not "cheaper per month"
             * — that's a footnote. The headline is "all 6,000 credits
             * available on day one", so an Anki migrator or someone
             * pre-illustrating a whole textbook can binge in week one
             * and not bump into a monthly cap. */}
            <div className="mb-4 rounded-xl border-2 border-primary/40 bg-primary/5 p-4 text-sm">
              <p className="font-editorial text-lg font-medium leading-tight">
                6,000 image credits.
                <br />
                <span className="italic text-[color:var(--primary)]">
                  All unlocked on day one.
                </span>
              </p>
              <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                Illustrate your entire library in one weekend — no monthly
                ceiling, no waiting twelve cycles. Equivalent to{" "}
                <span className="text-foreground font-medium">
                  1,200 Premium illustrations
                </span>{" "}
                or{" "}
                <span className="text-foreground font-medium">
                  6,000 Quick illustrations
                </span>
                . Top-up bundles purchased on top stack and never expire.
              </p>
            </div>

            <ul className="space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <svg
                    className="h-5 w-5 text-primary shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span
                    className={f.startsWith("Everything") ? "font-medium" : ""}
                  >
                    {f}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              className="w-full mt-6"
              onClick={() => handleUpgrade("yearly")}
              disabled={loading !== null}
            >
              {loading === "yearly"
                ? "Opening checkout…"
                : `Get yearly Pro · $${YEARLY_TOTAL.toFixed(2)}`}
            </Button>
            <p className="mt-3 text-[11px] text-muted-foreground text-center leading-relaxed">
              You&apos;ll be redirected to Stripe to complete payment securely.
            </p>
          </CardContent>
        </Card>

        {/* ── Monthly Pro ────────────────────────────────────────── */}
        <Card className="order-2 md:order-2 relative overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-baseline justify-between gap-2">
              <span className="font-editorial text-xl">Pro · Monthly</span>
              <div className="text-right">
                <span className="font-editorial text-2xl">
                  ${MONTHLY_PRICE}
                </span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Billed every month</p>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium">500 image credits per month</p>
              <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                Refreshes every billing cycle. Equivalent to 100 Premium or 500
                Quick illustrations. Unused credits don&apos;t roll over, but
                top-up bundles purchased on top stack and never expire.
              </p>
            </div>

            <ul className="space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <svg
                    className="h-5 w-5 text-primary shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span
                    className={f.startsWith("Everything") ? "font-medium" : ""}
                  >
                    {f}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              className="w-full mt-6"
              onClick={() => handleUpgrade("monthly")}
              disabled={loading !== null}
            >
              {loading === "monthly"
                ? "Opening checkout…"
                : `Get monthly Pro · $${MONTHLY_PRICE}`}
            </Button>
            <p className="mt-3 text-[11px] text-muted-foreground text-center leading-relaxed">
              You&apos;ll be redirected to Stripe to complete payment securely.
            </p>
          </CardContent>
        </Card>

        {/* ── Free ───────────────────────────────────────────────── */}
        <Card className="order-3 md:order-1">
          <CardHeader>
            <CardTitle className="flex items-baseline justify-between gap-2">
              <span className="font-editorial text-xl">Free</span>
              <div className="text-right">
                <span className="font-editorial text-2xl">$0</span>
                <span className="text-sm text-muted-foreground">/forever</span>
              </div>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              The whole app — try every Pro feature for 30 days
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium">25 starter image credits</p>
              <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                Enough for 5 Premium or 25 Quick illustrations. AI illustrations
                you generate stay visible for the first 30 days, then blur
                until you upgrade — your data is never deleted.
              </p>
            </div>

            <ul className="space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <svg
                    className="h-5 w-5 text-[color:var(--glow)] shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="w-full mt-6"
              onClick={() => router.push("/")}
            >
              Current Plan
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Side-by-side proof that Premium earns its 5 credits. The
       *  component renders nothing until we drop matched JPGs into
       *  /public/comparison/, so this is a no-op until ready. */}
      <QuickPremiumComparison />

      {/* Refund policy callout. Prevents Stripe chargeback weirdness
       * while staying user-fair: any unused purchase is refundable
       * within a week. */}
      <p className="text-center text-xs text-muted-foreground max-w-xl mx-auto leading-relaxed">
        All sales are final once any credits are used. Within 7 days of
        purchase, if no credits have been used, contact{" "}
        <a className="underline" href="mailto:support@huella.app">
          support@huella.app
        </a>{" "}
        for a refund. Cancel any time — your existing top-up credits are yours
        to keep.
      </p>
    </div>
  );
}
