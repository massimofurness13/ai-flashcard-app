"use client";

import { useState } from "react";

/**
 * Stats screenshot slot for the landing page. Renders the image
 * from /public/landing/stats.png if it exists, otherwise falls
 * back to a styled placeholder.
 *
 * Lives in its own client component because the onError handler
 * (which drives the placeholder swap) can't run inside the
 * server-rendered LandingPage. Tiny on purpose — keeps the rest
 * of the landing page on the server.
 */
export function StatsScreenshot() {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="aspect-[4/3] w-full rounded-2xl border border-dashed border-border bg-card/50 flex items-center justify-center text-center p-8">
        <div>
          <div className="text-3xl mb-2" aria-hidden>
            📊
          </div>
          <p className="text-sm text-muted-foreground">Stats screenshot</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            /public/landing/stats.png
          </p>
        </div>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/landing/stats.png"
      alt="FlashMind stats page"
      className="w-full rounded-2xl border border-border shadow-xl"
      onError={() => setErrored(true)}
    />
  );
}
