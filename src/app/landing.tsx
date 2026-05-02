import Link from "next/link";
import { LandingDemo } from "@/components/landing/landing-demo";
import { SwoopController } from "@/components/landing/swoop-controller";
import { ScreenshotSlot } from "@/components/landing/screenshot-slot";

// ─────────────────────────────────────────────────────────────────────
// Landing page — public-facing marketing surface for unauthenticated
// visitors. Rendered from src/app/page.tsx when getOptionalUser()
// returns null, or when ?preview=landing is set.
//
// Layout strategy:
//   • Hero with Spanish demo on the right.
//   • Hook stat — small, supporting.
//   • Manifesto pull-quote — one paragraph, the strongest line.
//   • French demo as its own anchored section, opposite alignment
//     to the hero, so users see two distinct moments instead of a
//     carousel.
//   • Differentiator block — "Everything your flashcard app does,
//     but better."
//   • Promise pull-quote — "You'll never want to go back."
//   • Features — six items, one-liner copy.
//   • Stanford / Horn quote.
//   • Honest progress / stats screenshot slot.
//   • Anki migration callout.
//   • Pricing.
//   • FAQ.
//   • Closing CTA + footer.
//
// Every section uses .swoop-* classes for scroll-driven entrance.
// SwoopController is mounted at the top to handle browsers that
// don't natively support animation-timeline (Safari, Firefox).
// ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: "🎨",
    eyebrow: "See",
    title: "A picture for every card",
    body: "AI-generated illustrations on every card. Pictures stick 6× harder than words alone.",
  },
  {
    icon: "🔊",
    eyebrow: "Hear",
    title: "Native voice engine",
    body: "Real native speakers, 30+ languages, automatically — not a robot for everyone.",
  },
  {
    icon: "⚡",
    eyebrow: "Generate",
    title: "Cards in seconds",
    body: "Paste notes, drop a PDF, type a topic. AI drafts the deck. You hit study.",
  },
  {
    icon: "🧠",
    eyebrow: "Remember",
    title: "Spaced repetition, invisible",
    body: "Proven SM-2 scheduling. You rate the card. The system handles when to show it next.",
  },
  {
    icon: "📊",
    eyebrow: "Track",
    title: "Honest progress",
    body: "Letter grades, streaks, a year-long activity heatmap. Built to motivate, not to manipulate.",
  },
  {
    icon: "🔄",
    eyebrow: "Switch",
    title: "Anki imports without losing a thing",
    body: "One-click .apkg import. Cards, history, media. Export back any time — no lock-in.",
  },
];

const pricing = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    blurb: "Everything most learners need.",
    features: [
      "Unlimited packs and cards",
      "SM-2 spaced repetition",
      "Native-speaker voices",
      "AI card generation from any text",
      "Import all common file types",
      "5 free Premium AI images to try",
    ],
    cta: "Start free",
    href: "/auth/signup",
    highlighted: false,
  },
  {
    name: "Pro · monthly",
    price: "$8.99",
    period: "/month",
    blurb: "AI illustrations on every card.",
    features: [
      "Everything in Free",
      "500 AI image credits / month",
      "Anki .apkg import + export",
      "Priority support",
    ],
    cta: "Try Pro",
    href: "/auth/signup",
    highlighted: true,
  },
  {
    name: "Pro · yearly",
    price: "$79.99",
    period: "/year",
    blurb: "Roughly 3 months free vs monthly.",
    features: [
      "Everything in Pro Monthly",
      "6,000 AI credits unlocked upfront",
      "Illustrate a whole library on day one",
      "Cancel anytime",
    ],
    cta: "Go yearly",
    href: "/auth/signup",
    highlighted: false,
    badge: "Best value",
  },
];

const faq = [
  {
    q: "How is this different from Anki?",
    a: "Same proven SM-2 spaced-repetition engine. Every card automatically gets an AI illustration and native-speaker audio so the meaning lands the first time, not the twentieth.",
  },
  {
    q: "Will my Anki cards work?",
    a: "Yes. One-click .apkg import preserves your cards, review history, and media. You can export back any time — no lock-in.",
  },
  {
    q: "What languages are supported?",
    a: "30+ for native-speaker audio: Spanish (Spain / Mexico / Argentina), French, German, Italian, Portuguese (BR + PT), Japanese, Korean, Mandarin, and more. Card content can be any language you can type.",
  },
  {
    q: "What happens if I cancel?",
    a: "Your text cards stay forever. AI images you created during Pro stay viewable while you're subscribed; if you cancel, they get a 'Resubscribe to view' overlay. Study progress and decks are never deleted.",
  },
  {
    q: "Is there a free trial of Pro?",
    a: "The Free tier gets 5 free Premium AI images to try the generation pipeline (or 25 Quick images, your call). Otherwise just start on Free — full app, all study features, native voices, AI card text generation, all included.",
  },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <SwoopController />

      {/* Ambient atmospheric gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--primary) 38%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-[40%] h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--glow) 35%, transparent), transparent 70%)",
        }}
      />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative px-4 pt-16 pb-16 sm:pt-24 sm:pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
            <div>
              <p className="label-caps">FlashMind — for language learners</p>
              <h1 className="font-editorial mt-4 text-4xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Memorize vocabulary{" "}
                <span className="italic text-[color:var(--primary)]">
                  6× faster
                </span>
                .<br />
                Your brain remembers pictures, not text.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                FlashMind gives every flashcard an AI illustration and a
                native-speaker voice — so the meaning lands the first time
                instead of the twentieth.
              </p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground/80">
                A tiny investment that saves you hundreds of hours of wasted
                learning time.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/auth/signup"
                  className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-7 text-base font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_88%,white)]"
                >
                  Start free
                </Link>
                <Link
                  href="#demo"
                  className="text-base text-muted-foreground transition-colors hover:text-foreground"
                >
                  See how it works →
                </Link>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Free forever · Pro from{" "}
                <span className="text-foreground font-medium">$8.99/mo</span>{" "}
                · No card needed to start
              </p>
            </div>

            <div id="demo" className="swoop-right">
              <LandingDemo cardKey="es" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Hook stat — visual recall comparison ─────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="space-y-8">
            <div className="swoop-up space-y-2 text-center sm:text-left">
              <p className="label-caps">After 72 hours, how much sticks?</p>
              <p className="text-sm text-muted-foreground max-w-xl">
                Plain text fades fast. Words paired with images stick — the
                most replicated finding in memory science.
              </p>
            </div>

            {/* Visual recall comparison bars. Width is set to the
             *  recall percentage; same scale on both rows so the
             *  contrast lands instantly. */}
            <div className="swoop-up space-y-5">
              <RecallBar
                label="Plain text"
                percent={10}
                tone="muted"
              />
              <RecallBar
                label="Words + memorable images"
                percent={65}
                tone="primary"
                emphasized
              />
            </div>

            <p className="swoop-up text-xs text-muted-foreground/80 text-center sm:text-left">
              Source: Lester (2006), Pictorial Superiority Effect · Paivio
              (1971), Dual Coding Theory
            </p>
          </div>
        </div>
      </section>

      {/* ── French demo section — moved before manifesto so the
       *  product proof comes first, the philosophy comes second. */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
            <div className="swoop-left order-2 lg:order-1">
              <LandingDemo cardKey="fr" />
            </div>
            <div className="swoop-right order-1 lg:order-2">
              <p className="label-caps">Memorable by design</p>
              <h2 className="font-editorial mt-4 text-3xl font-medium leading-tight text-foreground sm:text-4xl lg:text-5xl">
                Try forgetting{" "}
                <span className="italic text-[color:var(--primary)]">
                  this tomorrow.
                </span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                Our image engine is tuned specifically for memorability —
                vivid, character-led scenes that lock the meaning into
                your visual memory. Tap the card. Hear it in a native
                voice. Whatever you&apos;re learning, that&apos;s the
                picture you&apos;ll remember.
              </p>
              <p className="mt-5 font-editorial text-2xl text-foreground sm:text-3xl">
                <span className="italic text-[color:var(--primary)]">
                  From 1¢ per image.
                </span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Quick illustrations cost 1 credit (1¢). Premium cost 5
                credits (5¢) — same memorability dial, different art-
                direction budget.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Manifesto with filing-problem image ────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
            <div>
              <p className="label-caps swoop-up">Why FlashMind</p>
              <p className="swoop-up font-editorial mt-6 text-3xl font-medium leading-snug text-foreground sm:text-4xl">
                Most flashcard apps treat memory like a filing problem —{" "}
                <span className="italic text-[color:var(--primary)]">
                  feed it more, hope it sticks.
                </span>{" "}
                FlashMind starts from how memory actually works: with a
                picture, a sound, and a rhythm.
              </p>
            </div>
            <div className="swoop-right">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://fghxwycixcawwtctknmp.supabase.co/storage/v1/object/public/card-images/starter-packs/ai-1777682440948-b57kem.png"
                alt="Cartoon character overwhelmed by stacks of paper folders and cards"
                className="w-full rounded-2xl border border-border shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Differentiator + promise combined ───────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="label-caps swoop-up">If you&apos;ve used a flashcard app before</p>
          <h2 className="swoop-up font-editorial mt-4 text-4xl font-medium leading-tight text-foreground sm:text-6xl">
            Everything your flashcard app does.
            <br />
            <span className="italic text-[color:var(--primary)]">But better.</span>
          </h2>
          <p className="swoop-up mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            You&apos;ll never want to go back to learning without images
            again. Try it for a week — if you go back to plain flashcards
            after that, we&apos;d genuinely love to know why.
          </p>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 max-w-2xl">
            <p className="label-caps swoop-up">What you get</p>
            <h2 className="swoop-up font-editorial mt-3 text-3xl font-medium text-foreground sm:text-4xl">
              Six things that{" "}
              <span className="italic text-[color:var(--primary)]">
                make a difference
              </span>
              .
            </h2>
          </div>
          <div className="swoop-stagger grid grid-cols-1 gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="swoop-up rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl"
                    aria-hidden
                  >
                    {feature.icon}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="label-caps">{feature.eyebrow}</p>
                    <h3 className="font-editorial text-xl font-medium text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {feature.body}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats / progress screenshot ────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
            <div className="swoop-left">
              <p className="label-caps">Honest progress</p>
              <h2 className="font-editorial mt-3 text-3xl font-medium leading-tight text-foreground sm:text-4xl">
                See exactly where{" "}
                <span className="italic text-[color:var(--primary)]">
                  the work is paying off
                </span>
                .
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                Letter grades per pack, daily streaks, a 365-day activity
                heatmap. Built to motivate, not to manipulate.
              </p>
            </div>
            {/* Drop /public/landing/stats.png to activate the
             *  screenshot. Until then the placeholder shows.
             *  StatsScreenshot is a client component so the onError
             *  swap can run — landing.tsx itself stays on the
             *  server. */}
            <div className="swoop-right relative">
              <ScreenshotSlot
                src="/landing/stats.png"
                alt="FlashMind stats page"
                placeholderEmoji="📊"
                placeholderLabel="Stats screenshot"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Anki migration callout ─────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
            <div>
              <p className="label-caps swoop-up">Switching from Anki?</p>
              <h2 className="swoop-up font-editorial mt-3 text-3xl font-medium leading-tight text-foreground sm:text-4xl">
                Bring everything.{" "}
                <span className="italic text-[color:var(--primary)]">
                  Take it back any time.
                </span>
              </h2>
              <p className="swoop-up mt-6 text-base leading-relaxed text-muted-foreground">
                One-click .apkg import preserves your cards, review history,
                and media intact. Decide it isn&apos;t for you? Export back
                to Anki — no lock-in.
              </p>
              <div className="swoop-up mt-8">
                <Link
                  href="/auth/signup"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:border-[color:var(--primary)]"
                >
                  Import your Anki collection
                </Link>
              </div>
            </div>
            {/* Drop /public/landing/anki-import.png to activate.
             *  Until then a styled placeholder keeps the layout
             *  intentional. */}
            <div className="swoop-right">
              <ScreenshotSlot
                src="/landing/anki-import.png"
                alt="FlashMind one-click Anki import settings"
                placeholderEmoji="📥"
                placeholderLabel="Anki import screenshot"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 max-w-2xl">
            <p className="label-caps swoop-up">Pricing</p>
            <h2 className="swoop-up font-editorial mt-3 text-3xl font-medium text-foreground sm:text-4xl">
              Honest pricing,{" "}
              <span className="italic text-[color:var(--primary)]">
                cancel any time.
              </span>
            </h2>
            <p className="swoop-up mt-4 text-sm leading-relaxed text-muted-foreground">
              A tiny investment that saves you hundreds of hours of wasted
              learning time. Start free — upgrade when you want unlimited AI
              illustrations.
            </p>
          </div>

          <div className="swoop-stagger grid grid-cols-1 gap-6 lg:grid-cols-3">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`swoop-up relative overflow-hidden rounded-2xl border p-7 ${
                  plan.highlighted
                    ? "border-[color:var(--primary)] bg-card"
                    : "border-border bg-card"
                }`}
              >
                {plan.highlighted && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-50 blur-3xl"
                    style={{
                      background:
                        "radial-gradient(circle, color-mix(in oklch, var(--primary) 35%, transparent), transparent 70%)",
                    }}
                  />
                )}
                {plan.badge && (
                  <span className="absolute right-4 top-4 z-10 rounded-full bg-[color:var(--glow)]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--glow)]">
                    {plan.badge}
                  </span>
                )}
                <div className="relative">
                  <p className="label-caps">{plan.name}</p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-editorial text-5xl font-medium text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {plan.period}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {plan.blurb}
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5 leading-relaxed text-muted-foreground"
                      >
                        <span
                          aria-hidden
                          className="mt-[0.45em] inline-block h-1 w-1 shrink-0 rounded-full bg-[color:var(--primary)]"
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`mt-7 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      plan.highlighted
                        ? "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary)_88%,white)]"
                        : "border border-border hover:border-[color:var(--primary)]"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="label-caps swoop-up">FAQ</p>
          <h2 className="swoop-up font-editorial mt-3 text-3xl font-medium text-foreground sm:text-4xl">
            Frequently asked{" "}
            <span className="italic text-[color:var(--primary)]">questions</span>
            .
          </h2>
          <div className="swoop-stagger mt-10 space-y-8">
            {faq.map((item) => (
              <div key={item.q} className="swoop-up">
                <h3 className="font-editorial text-lg font-medium text-foreground">
                  {item.q}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ────────────────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="swoop-up font-editorial text-3xl font-medium leading-tight text-foreground sm:text-5xl">
            Ready to remember the things you study?
          </h2>
          <p className="swoop-up mt-5 text-base text-muted-foreground">
            One free account, no card needed. Make your first pack in under a
            minute.
          </p>
          <div className="swoop-up mt-8">
            <Link
              href="/auth/signup"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_88%,white)]"
            >
              Start free
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border px-4 py-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <p className="font-editorial italic text-foreground">
            Flash<span className="not-italic">Mind</span>
          </p>
          <div className="flex flex-wrap gap-6">
            <Link
              href="/auth/login"
              className="transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="transition-colors hover:text-foreground"
            >
              Create account
            </Link>
            <Link
              href="/pricing"
              className="transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-foreground"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface RecallBarProps {
  label: string;
  /** 0-100 — width of the filled segment, also displayed as the
   *  trailing percentage label. */
  percent: number;
  tone: "muted" | "primary";
  emphasized?: boolean;
}

/**
 * Horizontal recall comparison bar. Two of these stacked do most
 * of the persuasion work for the hook stat block — the visual
 * length difference between 10% and 65% lands the science before
 * a user has to read a single word about cognitive psychology.
 */
function RecallBar({ label, percent, tone, emphasized }: RecallBarProps) {
  const fill =
    tone === "primary"
      ? "bg-primary"
      : "bg-muted-foreground/40";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={`text-sm ${
            emphasized
              ? "font-medium text-foreground"
              : "text-muted-foreground"
          }`}
        >
          {label}
        </p>
        <p
          className={`font-editorial text-2xl ${
            emphasized
              ? "font-medium text-[color:var(--primary)]"
              : "text-muted-foreground"
          }`}
        >
          {percent}%
        </p>
      </div>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${fill} transition-all duration-700`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
