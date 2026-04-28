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
    eyebrow: "Generate",
    title: "Cards in seconds, from anything",
    body:
      "Paste notes, drop a PDF, type a topic. The AI drafts a complete deck — front, back, and a unique illustration on every card.",
  },
  {
    eyebrow: "See",
    title: "An image for every card",
    body:
      "Pictures are recalled at 65% after three days; plain text at 10%. Every card gets its own AI illustration so the meaning sticks.",
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
    blurb: "Everything most learners need.",
    features: [
      "Unlimited packs and cards",
      "SM-2 spaced repetition",
      "Native-speaker voices",
      "CSV / TSV / XML import",
      "Light + dark themes",
      "3 free AI image credits to try",
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
      "The Free tier gets 3 lifetime AI image credits to try the AI features. Otherwise, just start on Free — full app, all study features, native voices included. Upgrade when you want unlimited AI illustrations.",
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
                Memorize words{" "}
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
                No credit card. Free forever for the core experience.
              </p>
            </div>

            {/* Live demo — interactive flashcard preview. */}
            <div id="demo" className="relative">
              <LandingDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ── Hook stat ──────────────────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <p className="label-caps">The reason FlashMind exists</p>
          <h2 className="font-editorial mt-4 text-3xl font-medium leading-tight text-foreground sm:text-5xl">
            After three days, you forget{" "}
            <span className="italic text-[color:var(--primary)]">
              90%
            </span>{" "}
            of plain text.
            <br />
            With memorable pictures, you remember{" "}
            <span className="italic text-[color:var(--primary)]">
              65%
            </span>
            .
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            The Pictorial Superiority Effect is one of the most replicated
            findings in cognitive psychology. Pictures are encoded into both
            visual <em>and</em> semantic memory pathways automatically;
            words alone trigger only one. More pathways means more hooks
            for retrieval.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Source: Lester (2006), Pictorial Superiority Effect; Paivio
            (1971), Dual Coding Theory.
          </p>
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

      {/* ── Side-by-side comparison ────────────────────────────── */}
      <section className="relative border-t border-border px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 max-w-2xl">
            <p className="label-caps">Same word. Two ways to study it.</p>
            <h2 className="font-editorial mt-3 text-3xl font-medium text-foreground sm:text-4xl">
              The difference is{" "}
              <span className="italic text-[color:var(--primary)]">
                impossible to un-see.
              </span>
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <ComparisonCard
              title="Plain text card"
              kind="bad"
              text="el atardecer"
              caption="(translation: the sunset)"
            />
            <ComparisonCard
              title="FlashMind card"
              kind="good"
              text="el atardecer"
              caption="🌅 With illustration + native-speaker audio"
            />
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Same study time. Dramatically more recall.
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
              Start with the free tier — it has everything most learners need.
              Upgrade if you want unlimited AI illustrations, bulk generation,
              and Anki import/export.
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
          <p className="label-caps">Frequently asked</p>
          <h2 className="font-editorial mt-3 text-3xl font-medium text-foreground sm:text-4xl">
            Things people{" "}
            <span className="italic text-[color:var(--primary)]">always ask</span>
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

interface ComparisonCardProps {
  title: string;
  kind: "good" | "bad";
  text: string;
  caption: string;
}

function ComparisonCard({ title, kind, text, caption }: ComparisonCardProps) {
  return (
    <div
      className={`rounded-2xl border p-7 sm:p-8 ${
        kind === "bad"
          ? "border-dashed border-border bg-card/40"
          : "border-[color:var(--primary)]/40 bg-card shadow-lg"
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div
        className={`mt-4 rounded-xl border ${
          kind === "bad"
            ? "border-border bg-background"
            : "border-border bg-background"
        } p-6 text-center min-h-[200px] flex flex-col items-center justify-center gap-3`}
      >
        {kind === "good" && (
          <div
            aria-hidden
            className="w-20 h-20 rounded-xl border border-border flex items-center justify-center text-3xl"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--primary) 30%, transparent), color-mix(in oklch, var(--glow) 18%, transparent))",
            }}
          >
            🌅
          </div>
        )}
        <p className="font-editorial text-2xl font-medium text-foreground">
          {text}
        </p>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {kind === "bad"
          ? "One pathway: text → meaning. You'll need to see this card 15-20 times before it sticks."
          : "Two pathways: image AND text. You'll often nail it after 4-6 reviews."}
      </p>
    </div>
  );
}
