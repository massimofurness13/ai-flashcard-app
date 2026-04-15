import Link from "next/link";

const features = [
  {
    icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z",
    title: "AI-Powered Generation",
    description: "Generate flashcard sets from any topic or study material using Claude AI",
  },
  {
    icon: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z",
    title: "AI Image Generation",
    description: "Auto-generate relevant illustrations for every card with Stability AI",
  },
  {
    icon: "M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z",
    title: "Spaced Repetition (SM-2)",
    description: "Scientifically proven algorithm that schedules reviews at optimal intervals",
  },
  {
    icon: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5",
    title: "Anki Import & Export",
    description: "Seamlessly migrate from Anki with full SM-2 state and media preservation",
  },
  {
    icon: "M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z",
    title: "Text-to-Speech",
    description: "Listen to your cards with customisable voices and playback speed",
  },
  {
    icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
    title: "Progress Tracking",
    description: "Detailed stats, mastery grades, and review streaks to keep you motivated",
  },
];

const pricing = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "Unlimited decks & cards",
      "SM-2 spaced repetition",
      "Study sessions & review",
      "Progress tracking & stats",
      "CSV/TSV import",
      "Image uploads",
      "Text-to-speech",
      "Dark mode & themes",
    ],
    cta: "Get Started",
    href: "/auth/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$6.99",
    period: "/month",
    features: [
      "Everything in Free, plus:",
      "AI flashcard generation",
      "AI image generation",
      "Anki .apkg import",
      "Anki .apkg export",
      "Priority support",
    ],
    cta: "Start Free Trial",
    href: "/auth/signup",
    highlighted: true,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
            Study Smarter with{" "}
            <span className="text-primary">AI-Powered</span> Flashcards
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            FlashMind combines AI generation, spaced repetition, and Anki
            compatibility to help you learn anything faster.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Link
              href="/auth/signup"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              Start Learning for Free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background px-8 text-base font-semibold hover:bg-accent transition-colors"
            >
              View Pricing
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            No credit card required. Free forever for core features.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need to Study Effectively
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-background rounded-xl border border-border p-6 space-y-3"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg
                    className="h-5 w-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={feature.icon}
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Anki Migration CTA */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-3xl font-bold">Coming from Anki?</h2>
          <p className="text-lg text-muted-foreground">
            Import your entire Anki collection with one click. All your cards,
            review progress, and media come along. And if you ever want to go
            back, export to .apkg anytime.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Import Your Anki Decks
          </Link>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Simple, Transparent Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 space-y-4 ${
                  plan.highlighted
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-background"
                }`}
              >
                <div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-4xl font-extrabold">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">
                      {plan.period}
                    </span>
                  </div>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <svg
                        className="h-4 w-4 text-primary flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block w-full text-center h-10 leading-10 rounded-lg text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border hover:bg-accent"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <p>FlashMind</p>
          <div className="flex gap-6">
            <Link href="/auth/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link href="/auth/signup" className="hover:text-foreground transition-colors">
              Sign Up
            </Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
