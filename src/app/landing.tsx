import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────
// Landing page — editorial structural shell.
//
// The marketing copy below is intentionally LIGHT. The user (Massimo)
// is building a list of selling points + slogans separately and will
// rewrite the headlines, manifesto, and feature copy in a follow-up
// pass. The job of THIS file right now is to provide a clean editorial
// scaffold — typography, rhythm, sections, CTAs — that lands on-brand
// the moment they swap the copy in.
//
// Search this file for "TODO: marketing copy" to find every block that
// expects a rewrite.
// ─────────────────────────────────────────────────────────────────────

const features = [
  {
    eyebrow: "Generate",
    title: "Cards in seconds, from anything",
    body:
      "Paste notes, drop a PDF, type a topic. The app drafts a complete deck — front, back, and a unique illustration on every card.",
  },
  {
    eyebrow: "See",
    title: "An image for every card",
    body:
      "Pictures get remembered roughly six times more often than plain text. Every flashcard you create gets its own AI illustration, automatically.",
  },
  {
    eyebrow: "Hear",
    title: "Native-speaker voices, 30+ languages",
    body:
      "Mexican Spanish in a Mexican accent. Castilian in a Madrid accent. Real native voices per locale, not a generic robot for everyone.",
  },
  {
    eyebrow: "Remember",
    title: "Spaced repetition that stays out of the way",
    body:
      "Proven SM-2 scheduling under the hood. Just rate how well you knew the card; the app handles the rest.",
  },
  {
    eyebrow: "Track",
    title: "Honest progress, not vanity metrics",
    body:
      "Letter grades per pack, daily goal streaks, a 365-day activity calendar. Built to motivate, not to manipulate.",
  },
  {
    eyebrow: "Switch",
    title: "Anki imports without losing a thing",
    body:
      "Bring your existing .apkg collection in one click. Cards, review history, and media all carry over. Export back any time.",
  },
];

const pricing = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "Unlimited packs and cards",
      "SM-2 spaced repetition",
      "Native-speaker voices",
      "CSV / TSV / XML import",
      "15 lifetime AI image credits",
      "Light + dark themes",
    ],
    cta: "Start free",
    href: "/auth/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$6.99",
    period: "/month",
    features: [
      "Everything in Free, plus:",
      "AI card generation from any text",
      "500 AI image credits / month",
      "Anki .apkg import + export",
      "Premium voice quality",
    ],
    cta: "Start Pro",
    href: "/auth/signup",
    highlighted: true,
  },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient atmospheric gradient anchored top-right — same warm
       * glow used on the home-page hero, scaled up. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--primary) 38%, transparent), transparent 70%)",
        }}
      />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative px-4 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="mx-auto max-w-4xl">
          <p className="label-caps">FlashMind — for language learners</p>

          {/* TODO: marketing copy — main headline. Should be 1 line, max
           *  ~10 words, with one italicised accent phrase. */}
          <h1 className="font-editorial mt-4 text-5xl font-medium leading-[1.02] tracking-tight text-foreground sm:text-7xl">
            Flashcards you&apos;ll{" "}
            <span className="italic text-[color:var(--primary)]">
              actually
            </span>{" "}
            remember.
          </h1>

          {/* TODO: marketing copy — subhead. Should be 2-3 sentences,
           *  state the why. */}
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Because every card has a picture. Because the voice is a real
            native speaker. Because the system shows you the right card at
            exactly the right moment.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/auth/signup"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-7 text-base font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_88%,white)]"
            >
              Start free
            </Link>
            <Link
              href="/pricing"
              className="text-base text-muted-foreground transition-colors hover:text-foreground"
            >
              See plans →
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            No credit card. Free forever for the core experience.
          </p>
        </div>
      </section>

      {/* ── Manifesto / differentiation ────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="label-caps">Why FlashMind</p>

          {/* TODO: marketing copy — manifesto. This is where the user's
           *  list of differentiators will go. Treat it as a single
           *  editorial pull-quote rather than bullet points. */}
          <p className="font-editorial mt-6 text-3xl font-medium leading-snug text-foreground sm:text-4xl">
            Most flashcard apps treat memory like a filing problem —{" "}
            <span className="italic text-[color:var(--primary)]">
              feed it more, hope it sticks.
            </span>{" "}
            FlashMind starts from how memory actually works: with a
            picture, a sound, and a rhythm.
          </p>

          <p className="mt-8 text-base leading-relaxed text-muted-foreground">
            {/* TODO: marketing copy — supporting paragraph. */}
            We built this for the kind of learner who&apos;s tried Anki and
            bounced off, who has half a dozen Quizlet decks they never
            finished. The same spaced repetition engine, but everything
            around it — the cards, the voices, the interface — designed
            so you actually want to come back tomorrow.
          </p>
        </div>
      </section>

      {/* ── Feature grid ───────────────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 max-w-2xl">
            <p className="label-caps">What you get</p>
            <h2 className="font-editorial mt-3 text-3xl font-medium text-foreground sm:text-4xl">
              Six things that{" "}
              <span className="italic text-[color:var(--primary)]">
                make a difference
              </span>{" "}
              every session.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-x-12 gap-y-12 md:grid-cols-2">
            {features.map((feature) => (
              <article key={feature.title} className="space-y-3">
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

      {/* ── Anki migration callout ─────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="label-caps">Switching from Anki?</p>
          <h2 className="font-editorial mt-3 text-3xl font-medium leading-tight text-foreground sm:text-4xl">
            Bring everything.{" "}
            <span className="italic text-[color:var(--primary)]">
              Take it back any time.
            </span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            One-click .apkg import preserves your cards, review history, and
            media intact. If you ever decide FlashMind isn&apos;t for you,
            export back to .apkg and pick up where you left off in Anki —
            no lock-in, no data hostage situations.
          </p>
          <div className="mt-8">
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
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 max-w-2xl">
            <p className="label-caps">Pricing</p>
            <h2 className="font-editorial mt-3 text-3xl font-medium text-foreground sm:text-4xl">
              Honest pricing,{" "}
              <span className="italic text-[color:var(--primary)]">
                cancel any time.
              </span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Start with the free tier — it has everything most learners need.
              Upgrade if you want the AI generation features, more image
              credits, and Anki import/export.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`relative overflow-hidden rounded-2xl border p-7 ${
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

      {/* ── Closing CTA ────────────────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          {/* TODO: marketing copy — closing line. The last thing the
           *  user reads before signing up. */}
          <h2 className="font-editorial text-3xl font-medium leading-tight text-foreground sm:text-4xl">
            Ready when you are.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            One free account. No credit card. Make your first pack in under
            a minute.
          </p>
          <div className="mt-8">
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
              href="/about"
              className="transition-colors hover:text-foreground"
            >
              About
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
