"use client";

import { CreateMenu } from "@/components/home/create-menu";

/**
 * Welcome screen shown when a brand-new user lands on the home
 * page with zero packs in their library. The previous empty state
 * was a single sad-looking dashed box; this version walks the user
 * through the product in three steps, gives them three concrete
 * starting moves, and previews what a finished card looks like.
 *
 * Tone: warm, conversational, hand-held — copy will likely change,
 * but the structure is designed to convert "I just signed up" into
 * "I just made my first pack" within 60 seconds.
 */
interface FirstTimeWelcomeProps {
  userName: string;
}

export function FirstTimeWelcome({ userName }: FirstTimeWelcomeProps) {
  return (
    <div className="space-y-10">
      {/* ── Hero ── */}
      <section
        className="reveal"
        style={{ "--delay": "0ms" } as React.CSSProperties}
      >
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
            <p className="label-caps">First time here</p>
            <h1 className="font-editorial mt-3 text-4xl font-medium leading-tight text-foreground sm:text-5xl">
              Welcome,{" "}
              <span className="italic text-[color:var(--primary)]">
                {userName}
              </span>
              .
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              FlashMind turns anything you want to learn into flashcards
              with AI illustrations and native-speaker audio — then
              schedules them so they actually stick. Let&apos;s build
              your first pack together.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works (3-step tutorial) ── */}
      <section
        className="reveal"
        style={{ "--delay": "80ms" } as React.CSSProperties}
      >
        <p className="label-caps mb-4">How it works</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Step
            number={1}
            title="Make a pack"
            body="Paste text, upload a file, or just type in a topic. The AI writes the cards for you."
            emoji="📚"
          />
          <Step
            number={2}
            title="Study a few cards"
            body="A handful at a time — five minutes is enough. The app schedules each card for the moment you're about to forget it."
            emoji="🧠"
          />
          <Step
            number={3}
            title="Watch it stick"
            body="Daily streak, progress wheel, gentle reminders. You'll know within a week if it's working."
            emoji="✨"
          />
        </div>
      </section>

      {/* ── Sample card preview ── */}
      <section
        className="reveal"
        style={{ "--delay": "160ms" } as React.CSSProperties}
      >
        <p className="label-caps mb-4">What a card looks like</p>
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <SampleCard
              label="Front"
              emoji="🐱"
              text="el gato"
              caption="Spanish"
            />
            <div
              className="hidden sm:flex items-center justify-center text-2xl text-muted-foreground"
              aria-hidden
            >
              →
            </div>
            <div
              className="flex sm:hidden items-center justify-center text-2xl text-muted-foreground"
              aria-hidden
            >
              ↓
            </div>
            <SampleCard
              label="Back"
              emoji="🐱"
              text="the cat"
              caption="English"
              accent
            />
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground leading-relaxed">
            Tap the card to flip it. AI illustrations on every card,
            native-speaker audio on both sides if you set the language.
          </p>
        </div>
      </section>

      {/* ── Primary action ── */}
      <section
        className="reveal"
        style={{ "--delay": "240ms" } as React.CSSProperties}
      >
        <div className="rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-6 text-center sm:p-10">
          <h2 className="font-editorial text-2xl font-medium sm:text-3xl">
            Ready when you are.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Pick a way in. You can always add more packs later.
          </p>
          <div className="mt-6 inline-flex items-center gap-3">
            <CreateMenu />
          </div>
        </div>
      </section>
    </div>
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
    <div className="relative rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
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
            <span className="text-xl" aria-hidden>
              {emoji}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

interface SampleCardProps {
  label: string;
  emoji: string;
  text: string;
  caption: string;
  accent?: boolean;
}

function SampleCard({ label, emoji, text, caption, accent }: SampleCardProps) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div
        className={`rounded-2xl border p-6 shadow-sm transition-all ${
          accent
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-background"
        }`}
      >
        <div className="text-center">
          <div className="text-5xl mb-3" aria-hidden>
            {emoji}
          </div>
          <p className="font-editorial text-2xl font-medium">{text}</p>
          <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
        </div>
      </div>
    </div>
  );
}
