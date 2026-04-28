import Link from "next/link";

/**
 * Custom 404. Replaces Next's default white page with something
 * that matches the editorial aesthetic and gives the user an
 * obvious way back. No stack trace, no scary "Application error"
 * language — just "this isn't here, here's where you probably
 * meant to go."
 */
export default function NotFound() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div
          className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl"
          aria-hidden
        >
          🔎
        </div>
        <div className="space-y-2">
          <p className="label-caps">404</p>
          <h1 className="font-editorial text-3xl font-medium sm:text-4xl">
            We can&apos;t find that page.
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            It might have moved, or the link could be a typo. Either
            way, your decks and progress are safe — head back to the
            library and pick up where you left off.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Back to home
          </Link>
          <Link
            href="/study"
            className="inline-flex items-center justify-center h-10 rounded-md border border-border px-5 text-sm font-medium hover:border-primary/40 transition-colors"
          >
            Open study
          </Link>
        </div>
      </div>
    </main>
  );
}
