"use client";

import { useState } from "react";

/**
 * Screenshot slot for the landing page. Renders the image at `src`
 * if it exists, otherwise falls back to a styled placeholder so
 * the layout still feels intentional until a real screenshot is
 * dropped into /public/landing/.
 *
 * Lives in a client component because the onError handler (which
 * drives the placeholder swap) can't run inside the server-
 * rendered LandingPage. Same pattern works for any "real
 * screenshot will go here later" slot — pass src + emoji + label.
 */
interface ScreenshotSlotProps {
  src: string;
  alt: string;
  /** Emoji shown in the placeholder. */
  placeholderEmoji: string;
  /** First line of placeholder copy ("Stats screenshot"). */
  placeholderLabel: string;
}

export function ScreenshotSlot({
  src,
  alt,
  placeholderEmoji,
  placeholderLabel,
}: ScreenshotSlotProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="aspect-[4/3] w-full rounded-2xl border border-dashed border-border bg-card/50 flex items-center justify-center text-center p-8">
        <div>
          <div className="text-3xl mb-2" aria-hidden>
            {placeholderEmoji}
          </div>
          <p className="text-sm text-muted-foreground">{placeholderLabel}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{src}</p>
        </div>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      className="w-full rounded-2xl border border-border shadow-xl"
      onError={() => setErrored(true)}
    />
  );
}
