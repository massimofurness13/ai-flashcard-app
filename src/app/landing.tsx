import Link from "next/link";
import { LandingDemo } from "@/components/landing/landing-demo";

// ─────────────────────────────────────────────────────────────────────
// Landing page — public-facing marketing surface for unauthenticated
// visitors. Rendered from src/app/page.tsx when getOptionalUser()
// returns null.
//
// Copy strategy:
//   • Headline leads with the user's chosen line: pictures > text,
//     6× faster recall. Backed by real research (Lester 2006,
//     Paivio 1971).
//   • Hook stat block makes the science visible — 10% vs 65% recall
//     after 3 days, the central reason FlashMind exists.
//   • Live demo (LandingDemo) lets visitors flip a real card and
//     hear it before they sign up.
//   • Comparison block: plain text card vs FlashMind card, side
//     by side, so the differentiation is visual not just verbal.
//   • Pricing teases free + monthly + yearly, links to /pricing.
//   • FAQ short and direct.
//
// Search this file for `// REPLACE:` for spots that benefit from
// real screenshots / image URLs once we have them.
// ─────────────────────────────────────────────────────────────────────

const features = [
  {
    eyebrow: "See",
    title: "A picture for every card",
    body:
      "Pictures get remembered roughly 6× more often than words alone. Every card here gets its own AI illustration so the meaning sticks the first time, not the twentieth.",
  },
  {
    eyebrow: "Hear",
    title: "Native voice engine, 30+ languages",
    body:
      "Mexican Spanish in a Mexican accent. Castilian in a Madrid accent. Real native voices per locale, automatically — not a generic robot for everyone.",
  },
  {
    eyebrow: "Generate",
    title: "Cards in seconds, from anything",
    body:
      "Paste notes, drop a PDF, type a topic. The AI drafts a complete deck — front, back, and an illustration on every card.",
  },
  {
    eyebrow: "Remember",
    title: "Spaced repetition that stays out of the way",
    body:
      "Proven SM-2 scheduling under the hood. Just rate how well you knew the card; the app handles when to show it next.",
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
      "Bring your existing .apkg collection in one click. Cards, review history, and media all carry over. Export back any time — no lock-in.",
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
      "AI card generation from any text",
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
      "No throttling for big imports",
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
    a:
      "Same proven spaced-repetition engine (SM-2), but every card gets an AI illustration and native-speaker audio automatically. The whole experience is built so you actually want to come back tomorrow — without losing the rigour Anki users care about.",
  },
  {
    q: "Will my Anki cards work?",
    a:
      "Yes. One-click .apkg import preserves your cards, review history, and media intact. You can export back to Anki any time — no lock-in.",
  },
  {
    q: "What languages are supported?",
    a:
      "30+ for native-speaker audio, including Spanish (Spain + Mexico + Argentina), French, German, Italian, Portuguese (BR + PT), Japanese, Korean, Mandarin, and more. Card content can be any language.",
  },
  {
    q: "What happens if I cancel?",
    a:
      "Your text cards stay forever. AI-generated images you created during Pro stay viewable while you're subscribed; if you cancel, the images get a 'Resubscribe to view' overlay. Your study progress and decks are never deleted.",
  },
  {
    q: "Is there a free trial of Pro?",
    a:
      "The Free tier gets 5 free Premium AI images to try the generation pipeline (or 25 Quick images, your call). Otherwise just start on Free — full app, all study features, native voices, AI card text generation, all included. Upgrade when you want unlimited AI illustrations.",
  },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient atmospheric gradient anchored top-right */}
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
                Free forever · Pro from <span className="text-foreground font-medium">$8.99/mo</span>{" "}
                · No credit card
              </p>
            </div>

            {/* Live demo — interactive flashcard preview. */}
            <div id="demo" className="relative space-y-3">
              <LandingDemo />
              <p className="text-center text-xs text-muted-foreground/90 max-w-md mx-auto leading-relaxed">
                Pictures get remembered roughly{" "}
                <span className="text-foreground font-medium">
                  6× more often
                </span>{" "}
                than words alone. We just made it the default for every card.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Hook stat — supporting science block, not headline-sized ── */}
      <section className="relative border-t border-border px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="grid gap-6 sm:grid-cols-[1fr_2fr] sm:items-center">
            <div className="space-y-1">
              <p className="font-editorial text-4xl font-medium text-foreground sm:text-5xl">
                <span className="italic text-[color:var(--primary)]">10%</span>
                {" → "}
                <span className="italic text-[color:var(--primary)]">65%</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Recall after 72 hours
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-base leading-relaxed text-muted-foreground">
                After three days, you forget about 90% of plain text. With
                memorable pictures, recall stays around 65% — the most
                replicated finding in memory science. We just removed the
                friction of having to draw your own.
              </p>
              <p className="text-xs text-muted-foreground/80">
                Source: Lester (2006), Pictorial Superiority Effect; Paivio
                (1971), Dual Coding Theory.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Manifesto / differentiation ────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="label-caps">Why FlashMind</p>
          <p className="font-editorial mt-6 text-3xl font-medium leading-snug text-foreground sm:text-4xl">
            Most flashcard apps treat memory like a filing problem —{" "}
            <span className="italic text-[color:var(--primary)]">
              feed it more, hope it sticks.
            </span>{" "}
            FlashMind starts from how memory actually works: with a picture,
            a sound, and a rhythm.
          </p>
          <p className="mt-8 text-base leading-relaxed text-muted-foreground">
            Built for the kind of learner who&apos;s tried Anki and bounced
            off, who has half a dozen Quizlet decks they never finished. The
            same proven spaced-repetition engine, but everything around it —
            the illustrations, the voices, the pacing — designed so you
            actually want to come back tomorrow.
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Once you&apos;ve learned a word with a vivid image and a real
            voice in your ear, you don&apos;t want to go back to plain text
            cards. That&apos;s the entire pitch.
          </p>
        </div>
      </section>

      {/* ── Differentiator block ────────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="label-caps">If you&apos;ve used a flashcard app before</p>
          <h2 className="font-editorial mt-4 text-4xl font-medium leading-tight text-foreground sm:text-6xl">
            Everything your flashcard app does.
            <br />
            <span className="italic text-[color:var(--primary)]">But better.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Same proven spaced-repetition engine. Same import/export.
            Same gradings. Different cards, different rhythm, different
            outcome — because every card here gets a picture, a voice, and
            a system that actually wants you to come back tomorrow.
          </p>
          <p className="mx-auto mt-4 max-w-2xl font-editorial text-xl italic text-foreground/80 sm:text-2xl">
            Make flashcard learning enjoyable.
          </p>
        </div>
      </section>

      {/* ── Promise + comparison combined ──────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="label-caps">The bet we&apos;re making</p>
          <h2 className="font-editorial mt-4 text-3xl font-medium leading-tight text-foreground sm:text-5xl">
            You&apos;ll never want to go back to learning{" "}
            <span className="italic text-[color:var(--primary)]">
              without images
            </span>{" "}
            again.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Try it for a week. If you go back to plain flashcards after that,
            we&apos;d genuinely love to know why.
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

      {/* ── Stanford / Horn quote ──────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="label-caps">The science, in plainer English</p>
          <blockquote className="mt-6 border-l-2 border-[color:var(--primary)] pl-6">
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
          <p className="mt-8 text-base leading-relaxed text-muted-foreground">
            That&apos;s the bandwidth FlashMind is using. Words pair into
            memory through one channel; pictures pair into two. We just
            removed the friction of having to draw your own.
          </p>
        </div>
      </section>

      {/* ── Stats / progress screenshot ────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
            <div>
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
                heatmap. Real data from your real reviews — built to
                motivate, not to manipulate.
              </p>
            </div>
            {/* Screenshot slot. Drop a real /stats screenshot into
             *  /public/landing/stats.png to activate. Until then a
             *  styled placeholder keeps the layout intentional. */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/stats.png"
                alt="FlashMind stats page"
                className="w-full rounded-2xl border border-border shadow-xl"
                onError={(e) => {
                  // Fallback to placeholder when the image isn't there yet.
                  (e.target as HTMLImageElement).style.display = "none";
                  const sib = (e.target as HTMLImageElement)
                    .nextElementSibling as HTMLElement | null;
                  if (sib) sib.style.display = "flex";
                }}
              />
              <div
                className="hidden aspect-[4/3] w-full rounded-2xl border border-dashed border-border bg-card/50 items-center justify-center text-center p-8"
                style={{ display: "none" }}
              >
                <div>
                  <div className="text-3xl mb-2" aria-hidden>📊</div>
                  <p className="text-sm text-muted-foreground">
                    Stats screenshot
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    /public/landing/stats.png
                  </p>
                </div>
              </div>
            </div>
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
            export back to .apkg and pick up where you left off in Anki — no
            lock-in, no data hostage situations.
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
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 max-w-2xl">
            <p className="label-caps">Pricing</p>
            <h2 className="font-editorial mt-3 text-3xl font-medium text-foreground sm:text-4xl">
              Honest pricing,{" "}
              <span className="italic text-[color:var(--primary)]">
                cancel any time.
              </span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A tiny investment that saves you hundreds of hours of wasted
              learning time. Start free — upgrade if you want unlimited AI
              illustrations, bulk generation, and Anki import/export.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
          <p className="label-caps">FAQ</p>
          <h2 className="font-editorial mt-3 text-3xl font-medium text-foreground sm:text-4xl">
            Frequently asked{" "}
            <span className="italic text-[color:var(--primary)]">questions</span>
            .
          </h2>
          <div className="mt-10 space-y-8">
            {faq.map((item) => (
              <div key={item.q}>
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
          <h2 className="font-editorial text-3xl font-medium leading-tight text-foreground sm:text-5xl">
            Ready to remember the things you study?
          </h2>
          <p className="mt-5 text-base text-muted-foreground">
            One free account. No credit card. Make your first pack in under a
            minute.
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

