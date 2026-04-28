"use client";

import { useState } from "react";

/**
 * Side-by-side Quick vs Premium example pairs. Concrete proof that
 * Premium is worth the 5 credits — far more persuasive than copy
 * alone telling users it's "more memorable".
 *
 * Convention: drop matched pairs into `/public/comparison/` as
 *   quick-{slug}.jpg
 *   premium-{slug}.jpg
 * then add an entry below. The component skips rendering when the
 * pairs array is empty, so it stays invisible until real examples
 * exist — no broken-image placeholders shipped to production.
 */
const PAIRS: Array<{ slug: string; concept: string }> = [
  // Example entries — uncomment and add matching JPGs once we have
  // actual generated samples to show.
  //
  // { slug: "el-cocinero", concept: "El cocinero · The chef" },
  // { slug: "tomar-toro",  concept: "Tomar el toro por los cuernos · Take the bull by the horns" },
  // { slug: "die-geduld",  concept: "Die Geduld · Patience" },
];

export function QuickPremiumComparison() {
  const [activeIdx, setActiveIdx] = useState(0);

  if (PAIRS.length === 0) return null;
  const active = PAIRS[activeIdx];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          See the difference
        </p>
        <h3 className="font-editorial text-xl sm:text-2xl font-medium">
          Quick vs Premium
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Same card, two tiers. Quick gets the idea across. Premium
          gives you something your brain actually wants to remember.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">{active.concept}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/comparison/quick-${active.slug}.jpg`}
            alt={`Quick illustration of ${active.concept}`}
            className="w-full aspect-square object-cover rounded-xl border border-border"
          />
          <figcaption className="text-xs text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>✨</span>
              <span className="font-medium text-foreground">Quick</span>
            </span>
            <span>1 credit</span>
          </figcaption>
        </figure>
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/comparison/premium-${active.slug}.jpg`}
            alt={`Premium illustration of ${active.concept}`}
            className="w-full aspect-square object-cover rounded-xl border border-primary/40 shadow-md"
          />
          <figcaption className="text-xs text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>🎨</span>
              <span className="font-medium text-foreground">Premium</span>
              <span className="text-[9px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-1 py-0.5 rounded">
                Recommended
              </span>
            </span>
            <span>5 credits</span>
          </figcaption>
        </figure>
      </div>

      {PAIRS.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {PAIRS.map((pair, idx) => (
            <button
              key={pair.slug}
              type="button"
              onClick={() => setActiveIdx(idx)}
              aria-label={`Show example ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                idx === activeIdx
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
