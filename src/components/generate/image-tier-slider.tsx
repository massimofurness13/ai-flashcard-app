"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CREDIT_BUNDLES } from "@/components/subscription/quota-exceeded-dialog";
import { estimateImageGenTime } from "@/lib/utils";

interface ImageTierSliderProps {
  /** Total cards needing images (cards.length minus already-imaged). */
  total: number;
  /** Current Premium count (controlled by parent). */
  premiumCount: number;
  /** Called whenever the user drags the slider. */
  onChange: (value: number) => void;
  /**
   * Called when the user commits. `cap` is the maximum number of
   * images to generate, in card index order — provided when the user
   * is over budget and chose "Generate what I can afford" instead of
   * topping up. Undefined means "generate all `total`".
   */
  onGenerate: (cap?: number) => void;
}

interface QuotaState {
  totalRemaining: number;
  monthlyLimit: number;
  isPro: boolean;
}

const QUICK_COST = 1; // credits per Quick image
const PREMIUM_COST = 5; // credits per Premium image

/**
 * Greedy positional fit: walk cards 0..total, charge PREMIUM_COST for
 * the first `premiumCount`, QUICK_COST for the rest. Stop when adding
 * the next card would exceed `budget`. Returns how many cards we can
 * actually generate within budget and how much they'd cost.
 */
function fitWithinBudget(
  total: number,
  premiumCount: number,
  budget: number
): { affordable: number; cost: number; affordablePremium: number } {
  let cost = 0;
  let affordable = 0;
  let affordablePremium = 0;
  for (let i = 0; i < total; i++) {
    const itemCost = i < premiumCount ? PREMIUM_COST : QUICK_COST;
    if (cost + itemCost > budget) break;
    cost += itemCost;
    affordable++;
    if (i < premiumCount) affordablePremium++;
  }
  return { affordable, cost, affordablePremium };
}

/**
 * Silver/gold tier slider used after AI card generation. Drives the
 * Quick/Premium split for image generation: slider value = Premium
 * count, remainder = Quick. Track is colour-split — left of the
 * thumb fills with honey gold (Premium portion accumulating as the
 * user drags right), right of the thumb stays silver (Quick portion).
 *
 * When the user's chosen mix exceeds their available credits we don't
 * just disable the button — we offer two real paths: top up credits
 * inline (Stripe checkout to one of three bundles) or "generate what
 * I can afford" (positional cap, remaining cards saved without
 * illustrations). The latter is what the user explicitly asked for —
 * a graceful degrade rather than a hard block.
 */
export function ImageTierSlider({
  total,
  premiumCount,
  onChange,
  onGenerate,
}: ImageTierSliderProps) {
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);

  useEffect(() => {
    fetch("/api/images/quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: QuotaState | null) => setQuota(data))
      .catch(() => setQuota(null));
  }, []);

  // Clamp in case props go out of bounds (e.g. user just removed cards).
  const safePremium = Math.max(0, Math.min(premiumCount, total));
  const quickCount = total - safePremium;
  const totalCost = safePremium * PREMIUM_COST + quickCount * QUICK_COST;
  const fillPct = total === 0 ? 0 : (safePremium / total) * 100;

  // Style the native range input: left of thumb = gold, right = silver.
  const trackBackground = `linear-gradient(to right,
    color-mix(in oklch, var(--primary) 70%, transparent) 0%,
    color-mix(in oklch, var(--primary) 70%, transparent) ${fillPct}%,
    color-mix(in oklch, white 25%, transparent) ${fillPct}%,
    color-mix(in oklch, white 25%, transparent) 100%)`;

  const overBudget = quota !== null && totalCost > quota.totalRemaining;
  const fit =
    quota !== null
      ? fitWithinBudget(total, safePremium, quota.totalRemaining)
      : null;
  const skipped = fit ? total - fit.affordable : 0;

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

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        {/* Header */}
        <div>
          <p className="font-editorial text-xl font-medium">
            Add AI illustrations
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag the slider to choose how many cards get the premium
            illustration ({PREMIUM_COST} credits each, gold) versus the
            quick illustration ({QUICK_COST} credit each, silver).
          </p>
        </div>

        {/* Live counts — gold + silver pill labels */}
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--primary)" }}
            />
            <span className="font-editorial text-base font-medium">
              {safePremium}
            </span>
            <span className="text-muted-foreground">premium 🎨</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="font-editorial text-base font-medium">
              {quickCount}
            </span>
            <span className="text-muted-foreground">quick ✨</span>
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full bg-white/30"
            />
          </span>
        </div>

        {/* The slider itself. Native range input with custom track. */}
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={total}
            step={1}
            value={safePremium}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="tier-slider w-full cursor-pointer"
            style={{ background: trackBackground }}
            aria-label="Number of premium illustrations"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>All quick</span>
            <span>All premium</span>
          </div>
        </div>

        {/* Cost preview + budget context */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">Estimated cost</span>
            <span className="font-editorial text-lg font-medium">
              {totalCost.toLocaleString()} credit{totalCost === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {safePremium > 0 && quickCount > 0
                ? `${safePremium} × ${PREMIUM_COST} + ${quickCount} × ${QUICK_COST}`
                : safePremium > 0
                  ? `${safePremium} × ${PREMIUM_COST}`
                  : `${quickCount} × ${QUICK_COST}`}
            </span>
            {quota !== null && (
              <span className={overBudget ? "text-destructive" : ""}>
                {quota.totalRemaining.toLocaleString()} credits left
              </span>
            )}
          </div>
        </div>

        {/* Estimated time */}
        <p className="text-xs text-muted-foreground">
          Estimated time:{" "}
          {estimateImageGenTime(
            overBudget && fit ? fit.affordable : total
          )}
          . Cards generate in the background — you can keep editing
          while images roll in.
        </p>

        {/* Over-budget panel — top-up offer + graceful-degrade option */}
        {overBudget && fit !== null && quota !== null && !showTopUp && (
          <div
            className="space-y-3 rounded-lg border p-4"
            style={{ borderColor: "var(--destructive)" }}
          >
            <div>
              <p className="font-medium text-sm" style={{ color: "var(--destructive)" }}>
                Not enough credits
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                You have <strong className="text-foreground">{quota.totalRemaining}</strong>{" "}
                credit{quota.totalRemaining === 1 ? "" : "s"}. With your current
                mix you can only afford{" "}
                <strong className="text-foreground">
                  {fit.affordable} card{fit.affordable === 1 ? "" : "s"}
                </strong>{" "}
                (
                {fit.affordablePremium > 0 ? `${fit.affordablePremium} premium` : ""}
                {fit.affordablePremium > 0 && fit.affordable - fit.affordablePremium > 0
                  ? " + "
                  : ""}
                {fit.affordable - fit.affordablePremium > 0
                  ? `${fit.affordable - fit.affordablePremium} quick`
                  : ""}
                ). The remaining{" "}
                <strong className="text-foreground">{skipped}</strong> would save
                without illustrations.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                onClick={() => setShowTopUp(true)}
              >
                Top up credits
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onGenerate(fit.affordable)}
              >
                Generate {fit.affordable} card{fit.affordable === 1 ? "" : "s"} only
              </Button>
              <span className="text-xs text-muted-foreground">
                or drag the slider left for more quick images
              </span>
            </div>
          </div>
        )}

        {/* Inline bundle picker — surfaced when user hits "Top up" */}
        {showTopUp && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium text-sm">Buy more credits</p>
              <button
                type="button"
                onClick={() => setShowTopUp(false)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Purchased credits never expire and stack on top of your monthly
              allowance.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CREDIT_BUNDLES.map((bundle) => (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => handleBuy(bundle.id)}
                  disabled={purchasing !== null}
                  className={`group rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    bundle.popular
                      ? "border-[color:var(--primary)] bg-[color-mix(in_oklch,var(--primary)_8%,transparent)]"
                      : "border-border hover:border-[color:var(--primary)]"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-editorial text-lg font-medium">
                      {bundle.amount.toLocaleString()}
                    </span>
                    {bundle.popular && (
                      <span className="label-caps text-[color:var(--primary)]">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">credits</p>
                  <p className="mt-2 text-sm font-medium">
                    {bundle.label}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      · {bundle.perCredit}/credit
                    </span>
                  </p>
                  {purchasing === bundle.id && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Opening checkout…
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Primary actions when within budget */}
        {!overBudget && (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => onGenerate()}>Generate images</Button>
            <span className="text-sm text-muted-foreground">
              or skip to save the pack without illustrations.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
