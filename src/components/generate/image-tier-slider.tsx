"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CREDIT_BUNDLES } from "@/components/subscription/quota-exceeded-dialog";
import { openStripeCheckout } from "@/lib/stripe-checkout";
import {
  CreditBalance,
  useCreditBalance,
} from "@/components/subscription/credit-balance";
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
   * images to generate, in card index order. The slider ALWAYS passes
   * a cap equal to (premium + quick) so we never attempt to generate
   * an image for a card we can't pay for.
   */
  onGenerate: (cap: number) => void;
}

const QUICK_COST = 1; // credits per Quick image
const PREMIUM_COST = 5; // credits per Premium image

/**
 * Compute the affordable mix given user intent + budget.
 *
 *   premium = clamp(intent, 0, floor(budget / 5))
 *   quick   = min(total - premium, budget - 5*premium)
 *   skipped = total - premium - quick   (cards that save without images)
 *
 * Slider value is "intended premium". As the user drags right:
 *   - premium grows (budget permitting)
 *   - quick shrinks because each premium spends 5× what a quick would
 *   - skipped grows once budget runs out completely
 *
 * This means the slider always shows a *valid* mix (cost ≤ budget) —
 * we never tell the user "you can't afford this", we tell them which
 * affordable mix corresponds to where they dragged.
 */
function affordableMix(
  total: number,
  intendedPremium: number,
  budget: number
): { premium: number; quick: number; skipped: number; cost: number } {
  const maxPremium = Math.min(total, Math.floor(budget / PREMIUM_COST));
  const premium = Math.max(0, Math.min(intendedPremium, maxPremium));
  const remainingBudget = budget - premium * PREMIUM_COST;
  const quick = Math.max(0, Math.min(total - premium, remainingBudget));
  const skipped = total - premium - quick;
  const cost = premium * PREMIUM_COST + quick * QUICK_COST;
  return { premium, quick, skipped, cost };
}

/**
 * Silver/gold tier slider. Slider value = number of cards to make
 * Premium; quick auto-fills the remaining budget; anything that
 * doesn't fit becomes "skipped" (saves without an image).
 *
 * Track is split into three coloured segments — gold for premium,
 * silver for quick, dim grey for skipped — so the budget trade-off
 * is visible at a glance. As the user drags right, gold grows
 * (premium up), silver shrinks (quick eats fewer credits), dim grows
 * (more cards skipped). Inverse on drag-left.
 *
 * Top-up offer is always available as a soft CTA whenever skipped > 0,
 * so users on a constrained budget have a one-click path to fix it.
 */
export function ImageTierSlider({
  total,
  premiumCount,
  onChange,
  onGenerate,
}: ImageTierSliderProps) {
  // Shared hook so this slider's balance stays in sync with the
  // header pill, the per-card buttons, and any other surface that
  // dispatches credits:changed after a spend.
  const { quota } = useCreditBalance();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);

  // Until we know the budget, treat it as unlimited so the slider is
  // usable. The over-budget panel only appears once quota lands.
  const budget = quota?.totalRemaining ?? Number.POSITIVE_INFINITY;
  const mix = affordableMix(total, premiumCount, budget);
  const imaged = mix.premium + mix.quick;

  // Three-stop gradient for the track. Gold = premium, silver = quick,
  // dim = skipped. Stops are positioned by card-count proportion so
  // the visual segments line up with what the user is paying for.
  const premiumPct = total === 0 ? 0 : (mix.premium / total) * 100;
  const imagedPct = total === 0 ? 0 : (imaged / total) * 100;
  const trackBackground = `linear-gradient(to right,
    color-mix(in oklch, var(--primary) 75%, transparent) 0%,
    color-mix(in oklch, var(--primary) 75%, transparent) ${premiumPct}%,
    color-mix(in oklch, white 28%, transparent) ${premiumPct}%,
    color-mix(in oklch, white 28%, transparent) ${imagedPct}%,
    color-mix(in oklch, white 8%, transparent) ${imagedPct}%,
    color-mix(in oklch, white 8%, transparent) 100%)`;

  // Slider max — user can drag premium up to either the total card
  // count, or the budget cap, whichever is smaller. Past that point
  // they'd just be paying for fewer total images.
  const sliderMax =
    quota === null
      ? total
      : Math.min(total, Math.floor(budget / PREMIUM_COST));

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

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        {/* Header. Live credit balance sits inline with the eyebrow
         * so users always know what they're spending against. */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <p className="font-editorial text-xl font-medium">
              Add AI illustrations
            </p>
            <CreditBalance />
          </div>
          <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <p>
              <span className="text-foreground font-medium">Quick</span> images
              cost {QUICK_COST} credit each — clean and simple. They&apos;re
              fine if you&apos;re running out of credits and want to populate
              packs quickly and cheaply.
            </p>
            <p>
              That said, we&apos;d definitely recommend{" "}
              <span className="text-foreground font-medium">Premium</span> ({PREMIUM_COST}{" "}
              credits each). They&apos;re much higher quality and way more
              memorable — and memorable is the whole point. If you&apos;re
              serious about your learning and want cards that actually stick
              in your mind, Premium is what we&apos;d pick.
            </p>
            <p className="text-xs">
              Drag the slider to set your mix. The first cards in the pack
              get Premium; the rest get Quick. Anything you can&apos;t afford
              saves without an image.
            </p>
          </div>
        </div>

        {/* Honest note about where the field is. AI image generation is
         * still expensive and imperfect — the user sees the cost on
         * every card, so we owe them an explanation for why. Promise
         * to pass savings on as model costs drop, because that's what
         * we'll actually do. */}
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">
            A note on AI images:
          </span>{" "}
          AI image generation is still in its infancy and remains
          surprisingly expensive — that&apos;s why credits exist at all. As
          the underlying models get cheaper and better, we&apos;ll pass
          those savings straight back to you. Thanks for your patience while
          the field catches up.
        </div>

        {/* Live counts — three pills now: premium, quick, skipped */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--primary)" }}
            />
            <span className="font-editorial text-base font-medium">
              {mix.premium}
            </span>
            <span className="text-muted-foreground">premium 🎨</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full bg-white/40"
            />
            <span className="font-editorial text-base font-medium">
              {mix.quick}
            </span>
            <span className="text-muted-foreground">quick ✨</span>
          </span>
          {mix.skipped > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-white/15"
              />
              <span className="font-editorial text-base font-medium">
                {mix.skipped}
              </span>
              <span className="text-muted-foreground">no image</span>
            </span>
          )}
        </div>

        {/* The slider itself. Max is dynamic — capped at affordable
         * premium so the thumb never represents an unspendable amount. */}
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={sliderMax}
            step={1}
            value={Math.min(premiumCount, sliderMax)}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            disabled={sliderMax === 0}
            className="tier-slider w-full cursor-pointer disabled:cursor-not-allowed"
            style={{ background: trackBackground }}
            aria-label="Number of premium illustrations"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>All quick</span>
            <span>{sliderMax === total ? "All premium" : `Max ${sliderMax} premium`}</span>
          </div>
        </div>

        {/* Cost preview + budget context */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">Cost</span>
            <span className="font-editorial text-lg font-medium">
              {mix.cost.toLocaleString()} credit{mix.cost === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {mix.premium > 0 && mix.quick > 0
                ? `${mix.premium} × ${PREMIUM_COST} + ${mix.quick} × ${QUICK_COST}`
                : mix.premium > 0
                  ? `${mix.premium} × ${PREMIUM_COST}`
                  : mix.quick > 0
                    ? `${mix.quick} × ${QUICK_COST}`
                    : "—"}
            </span>
            {quota !== null && (
              <span>
                {(quota.totalRemaining - mix.cost).toLocaleString()} credits left
                after
              </span>
            )}
          </div>
        </div>

        {/* Estimated time */}
        {imaged > 0 && (
          <p className="text-xs text-muted-foreground">
            Estimated time: {estimateImageGenTime(imaged)}. Cards generate
            in the background — keep editing while images roll in.
          </p>
        )}

        {/* Top-up offer when there are skipped cards. Soft CTA, not
         * a blocker — user can always just generate the affordable
         * mix and live with skipped cards. */}
        {mix.skipped > 0 && quota !== null && !showTopUp && (
          <div className="rounded-lg border border-border bg-card p-3 text-sm">
            <p className="leading-relaxed text-muted-foreground">
              <span className="text-foreground font-medium">
                {mix.skipped} card{mix.skipped === 1 ? "" : "s"}
              </span>{" "}
              would save without illustrations. Want all{" "}
              {total} illustrated?
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => setShowTopUp(true)}>
                Top up credits
              </Button>
              <span className="text-xs text-muted-foreground">
                or generate the mix below as-is
              </span>
            </div>
          </div>
        )}

        {/* Inline bundle picker */}
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

        {/* Primary action — always present, never disabled, because the
         * mix shown is always affordable by construction. The cap sent
         * to onGenerate is the imaged count, so cards beyond it skip
         * cleanly without burning API calls. */}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => onGenerate(imaged)} disabled={imaged === 0}>
            {imaged === 0
              ? "No credits to spend"
              : `Generate ${imaged} image${imaged === 1 ? "" : "s"}`}
          </Button>
          {imaged > 0 && (
            <span className="text-sm text-muted-foreground">
              or skip to save the pack without illustrations.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
