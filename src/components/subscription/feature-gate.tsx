"use client";

import { UpgradeBanner } from "./upgrade-banner";

interface FeatureGateProps {
  isPro: boolean;
  feature: string;
  children: React.ReactNode;
  /** Show upgrade banner instead of hiding content (default: true) */
  showBanner?: boolean;
}

/**
 * Wraps Pro-only UI. Shows content for Pro users, upgrade prompt for free users.
 */
export function FeatureGate({
  isPro,
  feature,
  children,
  showBanner = true,
}: FeatureGateProps) {
  if (isPro) {
    return <>{children}</>;
  }

  if (showBanner) {
    return <UpgradeBanner feature={feature} />;
  }

  return null;
}
