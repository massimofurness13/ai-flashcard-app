import Link from "next/link";
import { LandingDemo } from "@/components/landing/landing-demo";
import { SwoopController } from "@/components/landing/swoop-controller";
import { StatsScreenshot } from "@/components/landing/stats-screenshot";

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
    eyebrow: "See",
    title: "A picture for every card",
    body: "AI-generated illustrations on every card. Pictures stick 6× harder than words alone.",
  },
  {
    eyebrow: "Hear",
    title: "Native voice engine",
    body: "Real native speakers, 30+ languages, automatically — not a robot for everyone.",
  },
  {
    eyebrow: "Generate",
    title: "Cards in seconds",
    body: "Paste notes, drop a PDF, type a topic. AI drafts the deck. You hit study.",
  },
  {
    eyebrow: "Remember",
    title: "Spaced repetition, invisible",
    body: "Proven SM-2 scheduling. You rate the card. The system handles when to show it next.",
  },
  {
    eyebrow: "Track",
    title: "Honest progress",
    body: "Letter grades, streaks, a year-long activity heatmap. Built to motivate, not to manipulate.",
  },
  {
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
                · No credit card
              </p>
            </div>

            <div id="demo" className="swoop-right">
              <LandingDemo cardKey="es" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Hook stat — supporting science block ─────────────────── */}
      <section className="relative border-t border-border px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="grid gap-6 sm:grid-cols-[1fr_2fr] sm:items-center">
            <div className="swoop-left space-y-1">
              <p className="font-editorial text-4xl font-medium text-foreground sm:text-5xl">
                <span className="italic text-[color:var(--primary)]">10%</span>
                {" → "}
                <span className="italic text-[color:var(--primary)]">65%</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Recall after 72 hours
              </p>
            </div>
            <div className="swoop-right space-y-3">
              <p className="text-base leading-relaxed text-muted-foreground">
                Plain text fades fast. Words paired with images stick. The
                most replicated finding in memory science — we just removed
                the friction of having to draw your own.
              </p>
              <p className="text-xs text-muted-foreground/80">
                Source: Lester (2006) · Paivio (1971), Dual Coding Theory
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Manifesto — single line, no paragraphs ──────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="label-caps swoop-up">Why FlashMind</p>
          <p className="swoop-up font-editorial mt-6 text-3xl font-medium leading-snug text-foreground sm:text-4xl">
            Most flashcard apps treat memory like a filing problem —{" "}
            <span className="italic text-[color:var(--primary)]">
              feed it more, hope it sticks.
            </span>{" "}
            FlashMind starts from how memory actually works: with a picture,
            a sound, and a rhythm.
          </p>
        </div>
      </section>

      {/* ── French demo section ──────────────────────────────────── */}
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
                Our image engine isn&apos;t a generic illustrator — it&apos;s
                tuned specifically for memorability. Every card gets a vivid,
                character-led scene that pins the meaning into your visual
                memory. Tap the card. Hear it in a native voice. Whether
                you&apos;re studying French, Japanese, or anything else,
                that&apos;s the picture you&apos;ll remember.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Differentiator ──────────────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="label-caps swoop-up">If you&apos;ve used a flashcard app before</p>
          <h2 className="swoop-up font-editorial mt-4 text-4xl font-medium leading-tight text-foreground sm:text-6xl">
            Everything your flashcard app does.
            <br />
            <span className="italic text-[color:var(--primary)]">But better.</span>
          </h2>
          <p className="swoop-up font-editorial mt-6 text-xl italic text-foreground/80 sm:text-2xl">
            Make flashcard learning enjoyable.
          </p>
        </div>
      </section>

      {/* ── Promise pull-quote ──────────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="label-caps swoop-up">The bet we&apos;re making</p>
          <h2 className="swoop-up font-editorial mt-4 text-3xl font-medium leading-tight text-foreground sm:text-5xl">
            You&apos;ll never want to go back to learning{" "}
            <span className="italic text-[color:var(--primary)]">
              without images
            </span>{" "}
            again.
          </h2>
          <p className="swoop-up mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Try it for a week. If you go back to plain flashcards after that,
            we&apos;d genuinely love to know why.
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
          <div className="swoop-stagger grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
            {features.map((feature) => (
              <article key={feature.title} className="swoop-up space-y-2">
                <p className="label-caps">{feature.eyebrow}</p>
                <h3 className="font-editorial text-xl font-medium text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stanford / Horn quote ──────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="label-caps swoop-up">The science, in plainer English</p>
          <blockquote className="swoop-up mt-6 border-l-2 border-[color:var(--primary)] pl-6">
            <p className="font-editorial text-2xl font-medium leading-snug text-foreground sm:text-3xl">
              &ldquo;When words and visual elements are closely entwined, we
              create something new and we augment our communal intelligence …
              visual language has the potential for{" "}
              <span className="italic text-[color:var(--primary)]">
                increasing &lsquo;human bandwidth&rsquo;
              </span>{" "}
              — the capacity to take in, comprehend, and more efficiently
              synthesize large amounts of new information.&rdquo;
            </p>
            <footer className="mt-5 text-sm text-muted-foreground">
              — Robert E. Horn, Stanford University
            </footer>
          </blockquote>
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
              <StatsScreenshot />
            </div>
          </div>
        </div>
      </section>

      {/* ── Anki migration callout ─────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="label-caps swoop-up">Switching from Anki?</p>
          <h2 className="swoop-up font-editorial mt-3 text-3xl font-medium leading-tight text-foreground sm:text-4xl">
            Bring everything.{" "}
            <span className="italic text-[color:var(--primary)]">
              Take it back any time.
            </span>
          </h2>
          <p className="swoop-up mt-6 text-base leading-relaxed text-muted-foreground">
            One-click .apkg import preserves your cards, review history, and
            media intact. Decide it isn&apos;t for you? Export back to Anki —
            no lock-in.
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
            One free account. No credit card. Make your first pack in under a
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
