"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

interface FlashcardImageProps {
  imageUrl?: string | null;
  cardText: string;
  className?: string;
  /**
   * Pass `false` to gate visibility behind a Pro subscription. When
   * gated, the underlying image is heavily blurred and overlaid with
   * a "Resubscribe to view" prompt. The image data still loads
   * (cheap, already on the user's CDN) so resubscription is instant.
   *
   * Defaults to `true` so editor surfaces — generate flow, single-card
   * edit, bulk edit — keep showing the real image without each call
   * site needing to thread isPro through props.
   */
  isPro?: boolean;
  /**
   * Which AI tier produced the image — drives a small corner badge
   * so the user can see the difference between Quick (1 credit, flat
   * vector) and Premium (5 credits, character-led illustration). Only
   * shown when an imageUrl is present and the tier is set; absent on
   * uploads, placeholders, and Pro-gated views.
   */
  imageTier?: "quick" | "premium" | null;
}

export function FlashcardImage({
  imageUrl,
  cardText,
  className,
  isPro = true,
  imageTier,
}: FlashcardImageProps) {
  if (imageUrl) {
    if (!isPro) {
      // Pro-gated: heavy blur on the image + small overlay with a
      // Resubscribe link. The image itself stays in the DOM so the
      // moment the user resubscribes, the next render shows it
      // unblurred with no extra fetch.
      return (
        <div
          className={cn(
            "relative w-full max-h-72 sm:max-h-80 rounded-lg overflow-hidden",
            className
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Card illustration (locked)"
            aria-hidden
            className="w-full max-h-72 sm:max-h-80 object-contain blur-2xl scale-110 opacity-70"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
            <div className="rounded-lg bg-background/85 px-3 py-2 text-center shadow-lg max-w-[85%]">
              <p className="text-[11px] font-medium leading-tight">
                AI image locked
              </p>
              <Link
                href="/pricing"
                className="text-[11px] text-primary underline-offset-2 hover:underline leading-tight"
              >
                Resubscribe to view
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("relative inline-block w-full", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Card illustration"
          className="w-full max-h-72 sm:max-h-80 object-contain rounded-lg"
        />
        {imageTier && (
          <span
            className={`absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm shadow-sm ${
              imageTier === "premium"
                ? "bg-primary/85 text-primary-foreground"
                : "bg-card/85 text-foreground border border-border"
            }`}
            title={
              imageTier === "premium"
                ? "Premium illustration · 5 credits"
                : "Quick illustration · 1 credit"
            }
          >
            <span aria-hidden>{imageTier === "premium" ? "🎨" : "✨"}</span>
            <span>{imageTier === "premium" ? "Premium" : "Quick"}</span>
          </span>
        )}
      </div>
    );
  }

  // Generate a placeholder gradient based on card text
  const hash = simpleHash(cardText);
  const hue1 = hash % 360;
  const hue2 = (hash * 7) % 360;
  const initials = cardText
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={cn(
        "w-full h-32 rounded-lg flex items-center justify-center",
        className
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue1}, 70%, 60%), hsl(${hue2}, 70%, 40%))`,
      }}
    >
      <span className="text-white/60 text-4xl font-bold">{initials}</span>
    </div>
  );
}
