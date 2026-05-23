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
   * Whether the viewer is currently entitled to *see* AI-generated
   * illustrations unblurred. Combines active-Pro and free-trial-
   * still-running into one boolean — compute it on the server via
   * `canViewAiImages(userId)` from src/lib/subscription.ts and pass
   * it in. When false, the image stays in the DOM (re-subscribing
   * is instant, no refetch) but renders blurred behind a
   * "Resubscribe to view" overlay. Defaults to `true` for editor
   * surfaces (generate flow, card edit) where the user has just
   * created the image and should always see what they're working on.
   */
  canViewAiImages?: boolean;
  /**
   * Which AI tier produced the image — drives a small corner badge
   * so the user can see the difference between Quick (1 credit, flat
   * vector) and Premium (5 credits, character-led illustration). Only
   * shown when an imageUrl is present and the tier is set; absent on
   * uploads, placeholders, and blurred (locked) views.
   */
  imageTier?: "quick" | "premium" | null;
}

export function FlashcardImage({
  imageUrl,
  cardText,
  className,
  canViewAiImages = true,
  imageTier,
}: FlashcardImageProps) {
  if (imageUrl) {
    if (!canViewAiImages) {
      // Free-trial expired or Pro lapsed: heavy blur on the image
      // + small overlay with a Resubscribe link. The image itself
      // stays in the DOM so the moment the user upgrades, the next
      // render shows it unblurred with no refetch.
      return (
        <div
          className={cn(
            "relative w-full max-h-72 sm:max-h-80 rounded-lg overflow-hidden",
            className,
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
                Subscribe to view
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
        {/* Tier badge intentionally removed (user feedback,
         *  May 2026): plastering "Premium" / "Quick" on the
         *  illustration itself reads as a marketing watermark.
         *  The visual difference between tiers is supposed to
         *  speak for itself; if it doesn't, the answer is to
         *  improve the cheap tier, not label the expensive one.
         *  Tier metadata still lives on the Card row and drives
         *  the regenerate-at-same-tier flow — we just don't
         *  display it on the rendered card. The imageTier prop
         *  is kept in the type so callers can keep threading it
         *  without breaking. */}
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
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue1}, 70%, 60%), hsl(${hue2}, 70%, 40%))`,
      }}
    >
      <span className="text-white/60 text-4xl font-bold">{initials}</span>
    </div>
  );
}
