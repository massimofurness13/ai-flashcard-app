"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Interactive flashcard demo embedded on the landing page. Click to
 * flip; click the speaker to hear the phrase in the native voice;
 * carousel between two examples (Spanish + French).
 *
 * Audio uses the public /api/landing/tts route — same Google Cloud
 * voices the authenticated app uses, scoped to a small phrase
 * whitelist so the route can serve anonymous landing visitors
 * without opening the main TTS endpoint up to abuse.
 *
 * The two demo cards are pulled from the founder's real Spanish and
 * French decks — premium-tier illustrations that show the AI image
 * engine at its strongest. If you ever want to swap them for
 * different examples, update the DEMO_CARDS constant AND the
 * whitelist in src/app/api/landing/tts/route.ts.
 *
 * Scroll behaviour: a subtle scroll-driven animation lets the card
 * float and rotate as the user moves down the hero. Implemented
 * with native CSS scroll-driven animations where supported (fallback
 * is just no animation — the static demo still works fine).
 */

interface DemoCard {
  front: string;
  back: string;
  imageUrl: string;
  frontLang: "es-MX" | "en-GB" | "fr-FR";
  backLang: "es-MX" | "en-GB" | "fr-FR";
  frontCaption: string;
  backCaption: string;
}

const DEMO_CARDS: DemoCard[] = [
  {
    front: "Aunque sea duro, hay que seguir.",
    back: "Even if it's hard, we have to continue.",
    imageUrl:
      "https://fghxwycixcawwtctknmp.supabase.co/storage/v1/object/public/card-images/d028213f-ceb3-4565-a1a3-384603bc136e/ai-1777423647747-3qcx1v.png",
    frontLang: "es-MX",
    backLang: "en-GB",
    frontCaption: "Spanish (Mexico)",
    backCaption: "English",
  },
  {
    front: "Avoir un chat dans la gorge",
    back: "To have a frog in one's throat",
    imageUrl:
      "https://fghxwycixcawwtctknmp.supabase.co/storage/v1/object/public/card-images/d028213f-ceb3-4565-a1a3-384603bc136e/ai-1777395034069-otszxd.png",
    frontLang: "fr-FR",
    backLang: "en-GB",
    frontCaption: "French",
    backCaption: "English",
  },
];

// In-memory cache so the second click on the same phrase plays
// instantly — first click hits the API, every click after reuses
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

export function LandingDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Stop any in-flight audio when the carousel switches cards or
  // the component unmounts.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const card = DEMO_CARDS[activeIdx];
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
    <div className="mx-auto max-w-md w-full landing-demo-float">
      <div className="relative" style={{ perspective: "1200px" }}>
        <div
          className={`relative w-full transition-transform duration-700 ease-out cursor-pointer ${
            mounted ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            aspectRatio: "4 / 5",
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
            caption={card.frontCaption}
            imageUrl={card.imageUrl}
            side="front"
          />
          <Face
            text={card.back}
            caption={card.backCaption}
            imageUrl={card.imageUrl}
            side="back"
            accent
          />
        </div>

        {/* Speaker button anchored to the card frame. Click stops
         *  propagation so it doesn't double-trigger a flip. */}
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

      {/* Tap hint + carousel dots */}
      <div className="mt-5 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {visibleCaption ? `${visibleCaption} · ` : ""}tap card to flip
        </p>
        {DEMO_CARDS.length > 1 && (
          <div className="flex items-center gap-1.5">
            {DEMO_CARDS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setActiveIdx(idx);
                  setFlipped(false);
                  audioRef.current?.pause();
                  setSpeaking(false);
                }}
                aria-label={`Show example ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === activeIdx
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface FaceProps {
  text: string;
  caption?: string;
  imageUrl: string;
  side: "front" | "back";
  accent?: boolean;
}

function Face({ text, caption, imageUrl, side, accent }: FaceProps) {
  return (
    <div
      className={`absolute inset-0 rounded-3xl border bg-card p-6 sm:p-7 flex flex-col shadow-xl ${
        accent ? "border-primary/40" : "border-border"
      }`}
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: side === "back" ? "rotateY(180deg)" : undefined,
      }}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{side === "front" ? "Front" : "Back"}</span>
        {caption && <span className="text-foreground/70">{caption}</span>}
      </div>

      <div className="mt-4 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl object-cover border border-border"
        />
      </div>

      <div className="flex-1 flex items-center justify-center px-2">
        <p className="font-editorial text-2xl sm:text-3xl font-medium text-center text-foreground leading-tight">
          {text}
        </p>
      </div>
    </div>
  );
}
