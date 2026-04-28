import Link from "next/link";

/**
 * Site-wide footer. Single row of links — Privacy, Terms, Contact —
 * plus a quiet "© FlashMind" mark. Sits at the bottom of the layout
 * via the parent flex column. Hidden on mobile when the bottom nav
 * is visible (the small bottom-padding offset on <main> already
 * accounts for that), shown on desktop.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60 mt-12 hidden md:block">
      <div className="mx-auto max-w-7xl px-4 py-6 flex items-center justify-between text-xs text-muted-foreground">
        <p>© {year} FlashMind</p>
        <nav className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
