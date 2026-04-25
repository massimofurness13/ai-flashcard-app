"use client";

import { useEffect, useState } from "react";
import type { QuotaState } from "@/lib/image-quota";
import { formatRelativeDate, cn } from "@/lib/utils";

/**
 * Cross-component credit display so every spend surface shows the
 * same number — the slider header, the per-card buttons, the single-
 * card form, the edit-cards header pill, etc.
 *
 * State is fetched per mounted instance from /api/images/quota, but
 * all instances also listen for the global `credits:changed` event.
 * After a user spends credits anywhere, call `emitCreditsChanged()` —
 * every mounted balance refetches at once. No context, no prop
 * drilling, no provider gymnastics.
 */

const CREDITS_CHANGED_EVENT = "flashmind:credits-changed";

/** Fire-and-forget: tell every mounted CreditBalance / useCreditBalance
 *  to refetch from /api/images/quota. Call after any credit-spending
 *  network request resolves so the user sees the new balance. */
export function emitCreditsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}

/**
 * Hook for components that need the actual quota *values* (e.g. the
 * tier slider, which has to compute affordable mix from
 * totalRemaining). Re-fetches automatically when emitCreditsChanged()
 * is dispatched anywhere on the page.
 */
export function useCreditBalance(): {
  quota: QuotaState | null;
  refresh: () => Promise<QuotaState | null>;
} {
  const [quota, setQuota] = useState<QuotaState | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/images/quota");
      if (res.ok) {
        const data = (await res.json()) as QuotaState;
        setQuota(data);
        return data;
      }
    } catch {
      // Non-fatal — UI just won't update this cycle
    }
    return null;
  }

  useEffect(() => {
    // Initial fetch on mount + event-driven refetches. Lint complains
    // about setState-via-async-fetch in an effect, but this IS the
    // recommended fetch-on-mount pattern — refresh awaits the API
    // before calling setQuota, so the state update doesn't happen
    // synchronously during the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const handler = () => {
      refresh();
    };
    window.addEventListener(CREDITS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, handler);
  }, []);

  return { quota, refresh };
}

interface CreditBalanceProps {
  /**
   * `inline` is a one-line label that fits next to a button group:
   *   "Balance: 423 credits · refresh in 12 days"
   * `pill` is a small clickable card-style block for the page header.
   */
  variant?: "inline" | "pill";
  /** Click handler — only honoured for the pill variant. */
  onClick?: () => void;
  className?: string;
}

export function CreditBalance({
  variant = "inline",
  onClick,
  className,
}: CreditBalanceProps) {
  const { quota } = useCreditBalance();

  if (!quota) {
    // Reserve a tiny placeholder so the layout doesn't shift when the
    // fetch resolves. Single-line height matches the inline variant.
    return (
      <span
        className={cn(
          "text-xs text-muted-foreground/60",
          variant === "pill" && "block h-[3.5rem]",
          className
        )}
        aria-hidden
      />
    );
  }

  const refreshText =
    quota.isPro && quota.resetAt
      ? `refresh ${formatRelativeDate(quota.resetAt)}`
      : null;

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors",
          onClick && "cursor-pointer hover:border-primary/50",
          className
        )}
        title={onClick ? "Click to top up credits" : undefined}
        disabled={!onClick}
      >
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
          Credits
        </p>
        <p className="font-editorial text-lg font-medium leading-tight mt-0.5">
          {quota.totalRemaining.toLocaleString()}
        </p>
        {refreshText && (
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
            {refreshText}
          </p>
        )}
      </button>
    );
  }

  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      Balance:{" "}
      <span className="font-medium text-foreground">
        {quota.totalRemaining.toLocaleString()}
      </span>{" "}
      credit{quota.totalRemaining === 1 ? "" : "s"}
      {refreshText && <> · {refreshText}</>}
    </span>
  );
}
