"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickPremiumComparison } from "@/components/subscription/quick-premium-comparison";
import { APP_NAME } from "@/lib/constants";
import { openStripeCheckout } from "@/lib/stripe-checkout";

type Plan = "monthly" | "yearly";

const features = {
  free: [
    "Create unlimited decks and cards",
    "Spaced repetition with proven SM-2 algorithm",
    "Progress tracking and mastery statistics",
    "Import from CSV, TSV, XML, and more",
    "Upload your own images to cards",
    "Text-to-speech with language options",
    "Light and dark themes",
  ],
  pro: [
    "Everything in Free, plus:",
    "AI-powered flashcard generation",
    "AI illustration generation for cards",
    "Anki .apkg import and export",
    "Priority support from our team",
  ],
};

export default function PricingPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>("monthly");
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
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
    setLoading(false);
  }

  // Math we want users to actually see — yearly is "three months free."
  // Monthly equivalent of yearly: $79.99 / 12 = $6.66/mo
  const monthlyPriceLabel = plan === "yearly" ? "$6.66" : "$8.99";
  const billingLabel =
    plan === "yearly"
      ? "$79.99 billed once a year"
      : "billed monthly";
  const ctaLabel = loading
    ? "Opening checkout…"
    : plan === "yearly"
      ? "Get yearly Pro · $79.99"
      : "Get monthly Pro · $8.99";

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-editorial text-3xl font-medium sm:text-4xl">
          {APP_NAME} Pricing
        </h1>
        <p className="text-muted-foreground">
          Start for free with no commitment. Upgrade whenever you&apos;re ready
          for more.
        </p>
      </div>

      {/* Monthly / Yearly toggle. Sits above the cards so the user
       * sees one clear price decision rather than two parallel CTAs. */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full border border-border bg-card p-1 text-sm">
          <button
            type="button"
            onClick={() => setPlan("monthly")}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              plan === "monthly"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setPlan("yearly")}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 transition-colors ${
              plan === "yearly"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
            <span
              className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${
                plan === "yearly"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-[color:var(--glow)]/20 text-[color:var(--glow)]"
              }`}
            >
              3 months free
            </span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Tier */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="font-editorial text-xl">Free</span>
              <span className="font-editorial text-2xl">$0</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Forever free</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {features.free.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <svg className="h-5 w-5 text-[color:var(--glow)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

        {/* Pro Tier */}
        <Card className="border-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
            POPULAR
          </div>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="font-editorial text-xl">Pro</span>
              <div className="text-right">
                <span className="font-editorial text-2xl">
                  {monthlyPriceLabel}
                </span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
            </CardTitle>
            <p className="text-sm text-muted-foreground">{billingLabel}</p>
          </CardHeader>
          <CardContent>
            {/* Plan-specific credit allowance callout — most important
             * info on the page once the user has decided on Pro. */}
            <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              {plan === "yearly" ? (
                <>
                  <p className="font-medium">
                    6,000 AI image credits — all unlocked upfront
                  </p>
                  <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                    Migrating from Anki? Burst-illustrate your whole library on
                    day one. Unused credits expire at the end of the year, but
                    any top-up bundles you buy on top stack and never expire.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">
                    500 AI image credits per month
                  </p>
                  <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                    Refreshes every billing cycle. Top-up bundles you buy on top
                    stack and never expire.
                  </p>
                </>
              )}
            </div>

            <ul className="space-y-3">
              {features.pro.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <svg className="h-5 w-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className={f.startsWith("Everything") ? "font-medium" : ""}>
                    {f}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              className="w-full mt-6"
              onClick={handleUpgrade}
              disabled={loading}
            >
              {ctaLabel}
            </Button>
            <p className="mt-3 text-[11px] text-muted-foreground text-center leading-relaxed">
              You&apos;ll be redirected to Stripe to complete payment securely.
            </p>
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
        <a className="underline" href="mailto:support@flashmind.app">
          support@flashmind.app
        </a>{" "}
        for a refund. Cancel any time — your existing top-up credits are yours
        to keep.
      </p>
    </div>
  );
}
