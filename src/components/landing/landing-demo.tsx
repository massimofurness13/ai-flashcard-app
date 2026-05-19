"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Interactive flashcard demo embedded on the landing page. Click
 * the card to flip; click the speaker to hear the phrase in the
 * native voice. Each instance shows ONE card — pass DEMO_CARDS.es
 * for the Spanish example or DEMO_CARDS.fr for the French one.
 * Two instances on the same page give us two distinct moments
 * instead of a single carousel.
 *
 * Audio uses the public /api/landing/tts route — same Google Cloud
 * voices the authenticated app uses, scoped to a four-phrase
 * whitelist so the route can serve anonymous landing visitors
 * without opening up the main TTS endpoint.
 *
 * If you ever swap the cards, update both DEMO_CARDS here AND the
 * whitelist in src/app/api/landing/tts/route.ts — they have to
 * match exactly.
 */

interface DemoCard {
  front: string;
  back: string;
  imageUrl: string;
  frontLang: "es-MX" | "en-GB" | "fr-FR";
  backLang: "es-MX" | "en-GB" | "fr-FR";
  frontCaption: string;
  backCaption: string;
  /** Which AI tier produced this image — drives the price chip
   *  shown under each demo card so visitors can see what each
   *  tier costs and compare quality with their own eyes. */
  tier: "quick" | "premium";
}

// Internal card data — kept inside this client module so it
// never has to cross the server→client boundary as a serialized
// prop. Callers reference cards by string key (DemoCardKey)
// instead of passing the object directly. Avoids a known
// Next/Turbopack quirk where exported objects from "use client"
// files don't always survive being passed back across the
// boundary as Server Component props.
const DEMO_CARDS_INTERNAL: Record<string, DemoCard> = {
  es: {
    front: "Aunque sea duro, hay que seguir.",
    back: "Even if it's hard, we have to continue.",
    imageUrl:
      "https://fghxwycixcawwtctknmp.supabase.co/storage/v1/object/public/card-images/d028213f-ceb3-4565-a1a3-384603bc136e/ai-1777423647747-3qcx1v.png",
    frontLang: "es-MX",
    backLang: "en-GB",
    frontCaption: "Spanish (Mexico)",
    backCaption: "English",
    tier: "premium",
  },
  fr: {
    front: "Avoir un chat dans la gorge",
    back: "To have a frog in one's throat",
    imageUrl:
      "https://fghxwycixcawwtctknmp.supabase.co/storage/v1/object/public/card-images/d028213f-ceb3-4565-a1a3-384603bc136e/ai-1777395034069-otszxd.png",
    frontLang: "fr-FR",
    backLang: "en-GB",
    frontCaption: "French",
    backCaption: "English",
    tier: "quick",
  },
};

export type DemoCardKey = "es" | "fr";

// In-memory cache so the second click on the same phrase plays
// instantly. First click hits the API, every click after reuses
// the Supabase URL.
const audioCache = new Map<string, string>();

async function fetchAudioUrl(
  text: string,
  languageCode: string
): Promise<string | null> {
  const key = `${languageCode}|${text}`;
  if (audioCache.has(key)) return audioCache.get(key)!;
  try {
    const res = await fetch("/api/landing/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { audioUrl?: string };
    if (data.audioUrl) audioCache.set(key, data.audioUrl);
    return data.audioUrl ?? null;
  } catch {
    return null;
  }
}

interface LandingDemoProps {
  cardKey: DemoCardKey;
  className?: string;
}

export function LandingDemo({ cardKey, className }: LandingDemoProps) {
  const card = DEMO_CARDS_INTERNAL[cardKey];
  const [flipped, setFlipped] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const visibleText = flipped ? card.back : card.front;
  const visibleLang = flipped ? card.backLang : card.frontLang;
  const visibleCaption = flipped ? card.backCaption : card.frontCaption;

  const speak = useCallback(async () => {
    audioRef.current?.pause();
    setSpeaking(true);
    const url = await fetchAudioUrl(visibleText, visibleLang);
    if (!url) {
      setSpeaking(false);
      return;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener("ended", () => setSpeaking(false));
    audio.addEventListener("error", () => setSpeaking(false));
    void audio.play().catch(() => setSpeaking(false));
  }, [visibleText, visibleLang]);

  return (
    // Mirror the in-app Flashcard sizing so the landing demo
    // showcases the *real* card UI users get inside the app —
    // wider container + full-width image + 520px min-height so
    // the front face has the same visual weight as study mode.
    // (Previously this was a small max-w-md, 4:5 locked square
    // with a fixed-size image, which made the marketing card
    // feel like a different product.)
    <div className={`mx-auto max-w-lg w-full ${className ?? ""}`}>
      <div className="relative" style={{ perspective: "1200px" }}>
        <div
          className={`relative w-full transition-transform duration-700 ease-out cursor-pointer ${
            mounted ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            minHeight: "520px",
          }}
          onClick={() => setFlipped((v) => !v)}
          role="button"
          tabIndex={0}
          aria-label={`Flashcard, currently showing ${flipped ? "back" : "front"}. Click to flip.`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFlipped((v) => !v);
            }
          }}
        >
          <Face
            text={card.front}
            imageUrl={card.imageUrl}
            side="front"
          />
          <Face
            text={card.back}
            imageUrl={card.imageUrl}
            side="back"
            accent
          />
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void speak();
          }}
          aria-label={`Hear "${visibleText}" spoken aloud in ${visibleCaption}`}
          className={`absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-card/85 backdrop-blur-sm border border-border text-foreground transition-colors ${
            speaking
              ? "border-primary text-primary"
              : "hover:border-primary/50"
          }`}
        >
          <svg
            className={`h-4 w-4 ${speaking ? "animate-pulse" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
        </button>
      </div>

      <p className="mt-4 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
        {visibleCaption} · tap card to flip
      </p>
      {/* Tier + price chip — frames the comparison between Quick
       *  and Premium tiers so visitors can see what each costs at
       *  a glance. */}
      <div className="mt-3 flex justify-center">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${
            card.tier === "premium"
              ? "bg-primary/15 text-foreground border border-primary/30"
              : "bg-muted text-muted-foreground border border-border"
          }`}
        >
          <span aria-hidden>{card.tier === "premium" ? "🎨" : "✨"}</span>
          <span className="font-semibold">
            {card.tier === "premium" ? "Premium" : "Quick"}
          </span>
          <span className="opacity-75">·</span>
          <span>
            {card.tier === "premium" ? "5 credits (5¢)" : "1 credit (1¢)"} per
            card
          </span>
        </span>
      </div>
    </div>
  );
}

interface FaceProps {
  text: string;
  imageUrl: string;
  side: "front" | "back";
  accent?: boolean;
}

function Face({ text, imageUrl, side, accent }: FaceProps) {
  return (
    // Padding (p-5 sm:p-8) and rounded radius match in-app
    // Flashcard.tsx so the marketing demo and the real card
    // read as the same component at a glance. Marketing keeps
    // the slightly softer rounded-3xl + shadow-xl polish.
    <div
      className={`absolute inset-0 rounded-3xl border bg-card p-5 sm:p-8 flex flex-col shadow-xl ${
        accent ? "border-primary/40" : "border-border"
      }`}
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: side === "back" ? "rotateY(180deg)" : undefined,
      }}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{side === "front" ? "Front" : "Back"}</span>
      </div>

      {/* Image renders the same way as flashcard-image.tsx: full
       *  width of the card, object-contain so the AI illustration
       *  fills the card naturally, max-h tuned so the text below
       *  always has room. Previously a fixed w-44/h-52 square. */}
      <div className="mt-4 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="w-full max-h-72 sm:max-h-80 rounded-lg object-contain"
        />
      </div>

      <div className="flex-1 flex items-center justify-center px-2 mt-4">
        <p className="font-editorial text-2xl sm:text-3xl font-medium text-center text-foreground leading-tight">
          {text}
        </p>
      </div>
    </div>
  );
}
