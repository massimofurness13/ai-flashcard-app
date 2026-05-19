"use client";

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
   * Legacy prop, retained for call-site compatibility but no longer
   * gates anything. Used to drive a "Resubscribe to view" blur for
   * users without Pro. That policy has been retired: once a user has
   * paid for an image — whether with their 25 free lifetime credits
   * or with subscription / purchased credits — the image is theirs
   * and stays visible. We don't paywall content the user already
   * owns.
   */
  isPro?: boolean;
  /**
   * Which AI tier produced the image — drives a small corner badge
   * so the user can see the difference between Quick (1 credit, flat
   * vector) and Premium (5 credits, character-led illustration). Only
   * shown when an imageUrl is present and the tier is set; absent on
   * uploads and placeholders.
   */
  imageTier?: "quick" | "premium" | null;
}

export function FlashcardImage({
  imageUrl,
  cardText,
  className,
  imageTier,
}: FlashcardImageProps) {
  if (imageUrl) {
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
