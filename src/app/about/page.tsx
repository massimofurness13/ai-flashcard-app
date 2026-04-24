import Link from "next/link";

export const metadata = {
  title: "About · FlashMind",
};

export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/account"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Account
        </Link>
        <h1 className="font-editorial text-3xl font-medium sm:text-4xl mt-1">About FlashMind</h1>
      </div>

      <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
        <p>
          FlashMind is a flashcard app built on one idea: <strong>we remember
          pictures far better than text</strong>. Research on the picture
          superiority effect has known this for decades — images recall at
          roughly 65% a week later, text alone at around 10%.
        </p>
        <p>
          Every card in FlashMind gets a unique AI-generated illustration,
          automatically, as you create your packs. No hunting for images, no
          manual editing. Just paste your notes, pick a pack, and learn.
        </p>
        <p>
          Under the hood it uses{" "}
          <strong>SM-2 spaced repetition</strong> — the same algorithm that
          powers Anki — scheduling each card so you see it exactly when
          you&apos;re about to forget. We pair that with text-to-speech,
          flexible pack layouts, and a clean mobile-first PWA.
        </p>
        <p>
          Built with Next.js, Prisma, Supabase, Anthropic&apos;s Claude for
          card generation, and FLUX for image generation.
        </p>
      </div>

      <div className="text-xs text-muted-foreground pt-4 border-t border-border">
        <p>
          Questions? <Link href="/contact" className="underline">Contact us</Link>
          . Want to see what&apos;s new? <Link href="/updates" className="underline">Updates</Link>.
        </p>
      </div>
    </div>
  );
}
