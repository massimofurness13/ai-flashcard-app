"use client";

import { useState, useEffect } from "react";

interface SubscriptionState {
  isPro: boolean;
  loading: boolean;
}

/**
 * Client-side hook to check subscription status.
 * Caches result for the session to avoid repeated API calls.
 */
export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({
    isPro: false,
    loading: true,
  });

  useEffect(() => {
    // Check sessionStorage cache first
    const cached = sessionStorage.getItem("flashmind-subscription");
    if (cached) {
      try {
        const data = JSON.parse(cached);
        // Cache valid for 5 minutes
        if (data.timestamp && Date.now() - data.timestamp < 5 * 60 * 1000) {
          setState({ isPro: data.isPro, loading: false });
          return;
        }
      } catch {
        // Ignore invalid cache
      }
    }

    // Fetch from dedicated status endpoint
    fetch("/api/subscription/status")
      .then((res) => res.json())
      .then((data) => {
        const isPro = data.isPro === true;
        sessionStorage.setItem(
          "flashmind-subscription",
          JSON.stringify({ isPro, timestamp: Date.now() })
        );
        setState({ isPro, loading: false });
      })
      .catch(() => {
        setState({ isPro: false, loading: false });
      });
  }, []);

  return state;
}
