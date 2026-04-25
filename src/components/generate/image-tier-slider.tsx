"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { estimateImageGenTime } from "@/lib/utils";

interface ImageTierSliderProps {
  /** Total cards needing images (i.e. cards.length minus already-imaged). */
  total: number;
  /** Current Premium count (controlled by parent). */
  premiumCount: number;
  /** Called whenever the user drags the slider. */
  onChange: (value: number) => void;
  /** Called when the user clicks "Generate images". */
  onGenerate: () => void;
}

interface QuotaState {
  totalRemaining: number;
  monthlyLimit: number;
  isPro: boolean;
}

const QUICK_COST = 1; // credit per Quick image
const PREMIUM_COST = 5; // credits per Premium image

/**
 * Silver/gold tier slider used after AI card generation. Drives the
 * Quick/Premium split for image generation: slider value = Premium
 * count, remainder = Quick. Track is colour-split — left of the
 * thumb fills with honey gold (Premium portion accumulating as the
 * user drags right), right of the thumb stays silver (Quick portion).
 *
 * UX intent: a single control where the visual literally encodes the
 * cost trade-off. Drag left = cheap, drag right = expensive, the
 * gold-vs-silver fill makes that trade-off legible at a glance.
 */
export function ImageTierSlider({
  total,
  premiumCount,
  onChange,
  onGenerate,
}: ImageTierSliderProps) {
  const [quota, setQuota] = useState<QuotaState | null>(null);

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
  // Inline gradient stops at the current fillPct so the thumb sits on
  // the colour boundary.
  const trackBackground = `linear-gradient(to right,
    color-mix(in oklch, var(--primary) 70%, transparent) 0%,
    color-mix(in oklch, var(--primary) 70%, transparent) ${fillPct}%,
    color-mix(in oklch, white 25%, transparent) ${fillPct}%,
    color-mix(in oklch, white 25%, transparent) 100%)`;

  const overBudget = quota !== null && totalCost > quota.totalRemaining;

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
                {quota.totalRemaining.toLocaleString()} credits left this month
              </span>
            )}
          </div>
          {overBudget && (
            <p className="mt-2 text-xs text-destructive">
              You don&apos;t have enough credits for this mix. Drag the slider
              left to use more Quick images, or top up from your account.
            </p>
          )}
        </div>

        {/* Estimated time */}
        <p className="text-xs text-muted-foreground">
          Estimated time: {estimateImageGenTime(total)}. Cards generate in
          the background — you can keep editing while images roll in.
        </p>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onGenerate} disabled={overBudget}>
            Generate images
          </Button>
          <span className="text-sm text-muted-foreground">
            or skip to save the pack without illustrations.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
