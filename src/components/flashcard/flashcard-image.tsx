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
}

export function FlashcardImage({ imageUrl, cardText, className }: FlashcardImageProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="Card illustration"
        className={cn("w-full max-h-48 object-contain rounded-lg", className)}
      />
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
