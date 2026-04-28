"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Interactive flashcard demo embedded on the landing page. Click to
 * flip, click the speaker to hear the word — exactly the in-app
 * experience, distilled to a single component that doesn't require
 * the rest of the app's auth/TTS plumbing.
 *
 * Audio uses Web Speech API directly. The polished cloud voice path
 * needs an authenticated /api/tts call, which we don't run for
 * unauthenticated landing visitors. Web Speech sounds fine for a
 * "this works" demo; we can upgrade to pre-generated MP3s later if
 * we want the demo voice to sound like the product voice.
 *
 * The DEMO_CARDS array is intentionally hard-coded — these are the
 * marketing demo, not real user data. Drop in matching image URLs
 * from a Supabase bucket once you've picked the pair.
 */

interface DemoCard {
  front: string;
  back: string;
  imageUrl: string;
  /** BCP-47 hint for the browser's speech synthesis voice picker. */
  frontLang?: string;
  backLang?: string;
  /** Caption shown under each side ("Spanish · El gato"). */
  frontCaption?: string;
  backCaption?: string;
}

// REPLACE: drop in image URLs from your existing Spanish pack so the
// demo shows your real generated artwork. Until then the placeholder
// images render as a soft gradient — the structure works either way.
const DEMO_CARDS: DemoCard[] = [
  {
    front: "el atardecer",
    back: "the sunset",
    imageUrl: "",
    frontLang: "es-ES",
    backLang: "en-GB",
    frontCaption: "Spanish",
    backCaption: "English",
  },
  {
    front: "la tormenta",
    back: "the storm",
    imageUrl: "",
    frontLang: "es-ES",
    backLang: "en-GB",
    frontCaption: "Spanish",
    backCaption: "English",
  },
];

export function LandingDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const card = DEMO_CARDS[activeIdx];
  const visibleText = flipped ? card.back : card.front;
  const visibleLang = flipped ? card.backLang : card.frontLang;
  const visibleCaption = flipped ? card.backCaption : card.frontCaption;

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(visibleText);
    if (visibleLang) utter.lang = visibleLang;
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  }, [visibleText, visibleLang]);

  return (
    <div className="mx-auto max-w-md w-full">
      <div
        className="relative"
        style={{ perspective: "1200px" }}
      >
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
            speak();
          }}
          aria-label={`Hear "${visibleText}" spoken aloud`}
          className="absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm border border-border text-foreground hover:border-primary/50 transition-colors"
        >
          <svg
            className="h-4 w-4"
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
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt=""
            className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl object-cover border border-border"
          />
        ) : (
          /* Placeholder gradient — until you drop in real demo image
           *  URLs the demo still feels intentional, not broken. */
          <div
            className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl border border-border flex items-center justify-center text-4xl"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--primary) 30%, transparent), color-mix(in oklch, var(--glow) 18%, transparent))",
            }}
            aria-hidden
          >
            ✨
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center">
        <p className="font-editorial text-3xl sm:text-4xl font-medium text-center text-foreground leading-tight">
          {text}
        </p>
      </div>
    </div>
  );
}
