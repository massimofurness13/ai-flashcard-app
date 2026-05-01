"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateMenu } from "@/components/home/create-menu";
import { Button } from "@/components/ui/button";

/**
 * Multi-step welcome flow for brand-new users (or returning users
 * who happen to land back on the home page with zero packs).
 *
 * Flow:
 *   intro  → warm greeting + 3-step "how it works" walkthrough
 *   picker → "what are you learning?" (language + level)
 *   offer  → "we've got a starter pack for that, want it?"
 *            OR "no starter pack yet, let's make your own"
 *
 * The picker answers are saved to User regardless of whether they
 * clone the starter pack — we still want the analytics and the
 * personal touch ("studying Spanish at A1") on subsequent visits.
 *
 * Tone: warm, conversational, never demanding. Every step has a
 * clear "skip this" option so we don't trap a user who just wants
 * to make their own pack.
 */
interface FirstTimeWelcomeProps {
  userName: string;
}

type Step = "intro" | "picker" | "offer";

const LANGUAGES: Array<{ code: string; name: string; flag: string }> = [
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Mandarin", flag: "🇨🇳" },
  { code: "en", name: "English", flag: "🇬🇧" },
];

// Extended list shown when the user clicks "Other". No starter
// packs for these yet — we still record the choice for analytics
// and gracefully pivot to the manual-create flow on the next step.
const MORE_LANGUAGES: Array<{ code: string; name: string; flag: string }> = [
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "he", name: "Hebrew", flag: "🇮🇱" },
  { code: "el", name: "Greek", flag: "🇬🇷" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "fi", name: "Finnish", flag: "🇫🇮" },
  { code: "da", name: "Danish", flag: "🇩🇰" },
  { code: "no", name: "Norwegian", flag: "🇳🇴" },
  { code: "cs", name: "Czech", flag: "🇨🇿" },
  { code: "ro", name: "Romanian", flag: "🇷🇴" },
  { code: "hu", name: "Hungarian", flag: "🇭🇺" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
  { code: "ms", name: "Malay", flag: "🇲🇾" },
];

const LEVELS: Array<{ code: string; label: string; sub: string }> = [
  { code: "A1", label: "A1", sub: "Just starting" },
  { code: "A2", label: "A2", sub: "Basic" },
  { code: "B1", label: "B1", sub: "Intermediate" },
  { code: "B2", label: "B2", sub: "Upper intermediate" },
  { code: "C1", label: "C1", sub: "Advanced" },
  { code: "C2", label: "C2", sub: "Mastery" },
  { code: "unsure", label: "Not sure", sub: "Pick something safe for me" },
];

interface StarterPreview {
  exists: boolean;
  name?: string;
  emoji?: string | null;
  description?: string | null;
  cardCount?: number;
  sampleCards?: Array<{ front: string; back: string }>;
}

export function FirstTimeWelcome({ userName }: FirstTimeWelcomeProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [language, setLanguage] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tag each preview response with the (lang|level) it was fetched
  // for. A stale response from an earlier selection falls through
  // naturally because the derived `preview` below only surfaces it
  // when its key matches the current selection. This avoids needing
  // a synchronous setState-in-effect to clear the value.
  const previewKey = `${language}|${level}`;
  const [previewEntry, setPreviewEntry] = useState<
    { key: string; data: StarterPreview } | null
  >(null);
  useEffect(() => {
    if (!language || !level || language === "other") return;
    const myKey = `${language}|${level}`;
    const controller = new AbortController();
    fetch(
      `/api/onboarding/starter?lang=${encodeURIComponent(language)}&level=${encodeURIComponent(level)}`,
      { signal: controller.signal }
    )
      .then((res) => res.json())
      .then((data: StarterPreview) =>
        setPreviewEntry({ key: myKey, data })
      )
      .catch(() => {
        // network / cancellation — nothing to recover from here
      });
    return () => controller.abort();
  }, [language, level]);
  const preview: StarterPreview | null =
    previewEntry?.key === previewKey ? previewEntry.data : null;

  async function completeOnboarding(clone: boolean) {
    if (!language || !level) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          level,
          cloneStarterPack: clone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      if (clone && data.deckId) {
        router.push(`/decks/${data.deckId}`);
        router.refresh();
      } else {
        // No clone (or no pack available) — drop the user into
        // the manual create-menu UI on the home page.
        router.refresh();
      }
    } catch {
      setError("Network error. Try again in a moment.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10 pb-12">
      {step === "intro" && <IntroStep userName={userName} onContinue={() => setStep("picker")} />}
      {step === "picker" && (
        <PickerStep
          language={language}
          level={level}
          onLanguage={setLanguage}
          onLevel={setLevel}
          onBack={() => setStep("intro")}
          onContinue={() => setStep("offer")}
        />
      )}
      {step === "offer" && (
        <OfferStep
          userName={userName}
          language={language}
          level={level}
          preview={preview}
          busy={busy}
          error={error}
          onUseStarter={() => completeOnboarding(true)}
          onSkip={() => completeOnboarding(false)}
          onBack={() => setStep("picker")}
        />
      )}
    </div>
  );
}

// ── Step 1: Intro ─────────────────────────────────────────────────

interface IntroStepProps {
  userName: string;
  onContinue: () => void;
}

function IntroStep({ userName, onContinue }: IntroStepProps) {
  return (
    <>
      <section className="reveal" style={{ "--delay": "0ms" } as React.CSSProperties}>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-12 sm:px-10 sm:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-50 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklch, var(--primary) 45%, transparent), transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -bottom-32 h-72 w-72 rounded-full opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklch, var(--glow) 40%, transparent), transparent 70%)",
            }}
          />
          <div className="relative max-w-2xl">
            <p className="label-caps">Welcome to FlashMind</p>
            <h1 className="font-editorial mt-3 text-4xl font-medium leading-tight text-foreground sm:text-5xl">
              Lovely to meet you,{" "}
              <span className="italic text-[color:var(--primary)]">{userName}</span>.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              In a moment we&apos;ll ask what you&apos;re learning, drop a starter pack into
              your library, and have you studying within thirty seconds.
              No setup, no homework — just hit Continue.
            </p>
            <div className="mt-7">
              <Button size="md" onClick={onContinue}>
                Continue →
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="reveal" style={{ "--delay": "120ms" } as React.CSSProperties}>
        <p className="label-caps mb-4">How it works</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Step number={1} title="Tell us what you're learning" body="Language and level — takes ten seconds." emoji="🌍" />
          <Step number={2} title="Get a ready-made starter pack" body="Or build your own from scratch. Either way, you're ready in seconds." emoji="📚" />
          <Step number={3} title="Study a few, watch it stick" body="Spaced repetition does the timing. You just rate how you knew each card." emoji="✨" />
        </div>
      </section>
    </>
  );
}

interface StepProps {
  number: number;
  title: string;
  body: string;
  emoji: string;
}

function Step({ number, title, body, emoji }: StepProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold"
          aria-hidden
        >
          {number}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-editorial text-lg font-medium">{title}</h3>
            <span className="text-xl" aria-hidden>{emoji}</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Picker ────────────────────────────────────────────────

interface PickerStepProps {
  language: string;
  level: string;
  onLanguage: (v: string) => void;
  onLevel: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

function PickerStep({
  language,
  level,
  onLanguage,
  onLevel,
  onBack,
  onContinue,
}: PickerStepProps) {
  // "Other" expands an extended language list + a free-text input
  // for whatever isn't in the list. Once they pick anything from the
  // expanded list (or type a custom name), `language` is set and the
  // continue button enables. The first-tier list (LANGUAGES) is kept
  // visually selectable; selecting any of those collapses the
  // "other" panel back down so the UI doesn't get crowded.
  const isCommonLanguage = LANGUAGES.some((l) => l.code === language);
  const [showOther, setShowOther] = useState(
    !!language && !isCommonLanguage
  );
  const [customLang, setCustomLang] = useState(
    !isCommonLanguage && language && !MORE_LANGUAGES.some((l) => l.code === language)
      ? language
      : ""
  );
  const ready = !!language && !!level;
  return (
    <section className="reveal max-w-3xl mx-auto" style={{ "--delay": "0ms" } as React.CSSProperties}>
      <p className="label-caps">A couple of quick questions</p>
      <h2 className="font-editorial mt-3 text-3xl font-medium leading-tight text-foreground sm:text-4xl">
        What are you{" "}
        <span className="italic text-[color:var(--primary)]">learning</span>?
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-xl">
        We&apos;ll line up a starter pack so you can start studying right away.
        You can always change what you study later.
      </p>

      <div className="mt-8 space-y-2">
        <p className="text-sm font-medium">Language</p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                onLanguage(l.code);
                setShowOther(false);
                setCustomLang("");
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                language === l.code
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <span aria-hidden>{l.flag}</span>
              <span>{l.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setShowOther((v) => !v);
              if (!showOther) {
                // Opening the panel — clear any selected common
                // language so the user knows they're now in
                // "other" mode.
                onLanguage("");
              }
            }}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
              !isCommonLanguage && (showOther || !!language)
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <span aria-hidden>🌍</span>
            <span>Other…</span>
          </button>
        </div>

        {showOther && (
          <div className="mt-3 rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Pick from more languages
              </p>
              <div className="flex flex-wrap gap-2">
                {MORE_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      onLanguage(l.code);
                      setCustomLang("");
                    }}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      language === l.code
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <span aria-hidden>{l.flag}</span>
                    <span>{l.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Or type your own
              </p>
              <input
                type="text"
                value={customLang}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomLang(v);
                  // Use the typed value as the language code (kept
                  // as-is for analytics — we don't try to ISO-match
                  // because someone might write "Old English" or
                  // "Klingon" and that's fine for our purposes).
                  if (v.trim()) {
                    onLanguage(v.trim().toLowerCase());
                  } else {
                    onLanguage("");
                  }
                }}
                placeholder="e.g. Welsh, Tagalog, Swahili…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
              />
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                We don&apos;t have a starter pack for niche languages yet, but
                you can build your own in the next step.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-2">
        <p className="text-sm font-medium">Level</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => onLevel(l.code)}
              className={`rounded-2xl border p-3 text-left transition-colors ${
                level === l.code
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <p className="font-editorial text-lg font-medium leading-tight">
                {l.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{l.sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button size="md" onClick={onContinue} disabled={!ready}>
          Continue →
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>
    </section>
  );
}

// ── Step 3: Offer ─────────────────────────────────────────────────

interface OfferStepProps {
  userName: string;
  language: string;
  level: string;
  preview: StarterPreview | null;
  busy: boolean;
  error: string | null;
  onUseStarter: () => void;
  onSkip: () => void;
  onBack: () => void;
}

function OfferStep({
  userName,
  language,
  level,
  preview,
  busy,
  error,
  onUseStarter,
  onSkip,
  onBack,
}: OfferStepProps) {
  // Preview hasn't loaded yet — show a soft skeleton.
  if (!preview) {
    return (
      <section className="reveal max-w-3xl mx-auto" style={{ "--delay": "0ms" } as React.CSSProperties}>
        <p className="label-caps">Almost there</p>
        <p className="mt-4 text-sm text-muted-foreground">Looking up a starter pack for you…</p>
      </section>
    );
  }

  if (preview.exists) {
    return (
      <section className="reveal max-w-3xl mx-auto" style={{ "--delay": "0ms" } as React.CSSProperties}>
        <p className="label-caps">Ready to go, {userName}</p>
        <h2 className="font-editorial mt-3 text-3xl font-medium leading-tight text-foreground sm:text-4xl">
          We&apos;ve got{" "}
          <span className="italic text-[color:var(--primary)]">{preview.cardCount} cards</span>{" "}
          waiting for you.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-xl">
          {preview.description}
        </p>

        <div className="mt-8 rounded-3xl border border-primary/30 bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl"
              aria-hidden
            >
              {preview.emoji ?? "✨"}
            </div>
            <div>
              <p className="font-editorial text-xl font-medium">{preview.name}</p>
              <p className="text-xs text-muted-foreground">
                {preview.cardCount} cards · {language.toUpperCase()} · {level}
              </p>
            </div>
          </div>

          {preview.sampleCards && preview.sampleCards.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                A taste of what&apos;s inside
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {preview.sampleCards.map((card) => (
                  <div
                    key={card.front}
                    className="rounded-xl border border-border bg-background px-4 py-3 text-center"
                  >
                    <p className="font-editorial text-base font-medium text-foreground">
                      {card.front}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.back}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-5 text-[11px] text-muted-foreground leading-relaxed">
            We&apos;ve mixed{" "}
            <span className="text-foreground font-medium">Quick ✨</span>{" "}
            and{" "}
            <span className="text-foreground font-medium">Premium 🎨</span>{" "}
            illustrations in this pack so you can see the difference between
            the two AI tiers as you study. Premium is what we&apos;d
            recommend for the cards you really want to remember.
          </p>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="md" onClick={onUseStarter} disabled={busy}>
            {busy ? "Setting up your library…" : "Start with this pack →"}
          </Button>
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            I&apos;d rather build my own
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            ← Pick a different language
          </button>
        </div>
      </section>
    );
  }

  // No starter pack for this combo yet — pivot to the manual flow.
  return (
    <section className="reveal max-w-3xl mx-auto" style={{ "--delay": "0ms" } as React.CSSProperties}>
      <p className="label-caps">A bespoke first pack</p>
      <h2 className="font-editorial mt-3 text-3xl font-medium leading-tight text-foreground sm:text-4xl">
        We don&apos;t have a ready-made pack for that combo yet —{" "}
        <span className="italic text-[color:var(--primary)]">let&apos;s make yours</span>.
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground max-w-xl">
        Paste any text, upload a file, or pick a topic. We&apos;ll turn it into
        a fresh deck with illustrations and audio. Takes about a minute.
      </p>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <CreateMenu />
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {busy ? "Saving…" : "Or just take me to my library"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          ← Pick a different language
        </button>
      </div>
    </section>
  );
}
