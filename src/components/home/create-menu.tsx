"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Single entry-point to the create flow. We deliberately removed the
 * dropdown that used to fork into "Create Pack / Import / Generate AI"
 * — the new unified /generate page detects intent from what the user
 * pastes or uploads (Anki .apkg → Anki importer; everything else →
 * AI generation, which also handles plain CSV/text dumps just fine).
 */
export function CreateMenu() {
  return (
    <Link href="/generate" className={buttonVariants({ size: "md" })}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      New
    </Link>
  );
}
