import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · FlashMind",
  description:
    "The agreement between you and FlashMind, in plain English.",
};

const LAST_UPDATED = "28 April 2026";
const SUPPORT_EMAIL = "support@flashmind.app";

export default function TermsPage() {
  return (
    <article className="legal-page max-w-3xl mx-auto">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          FlashMind
        </p>
        <h1 className="font-editorial text-4xl font-medium mt-2">
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <p>
        These terms set out the agreement between you and FlashMind
        when you use the app. By creating an account, you agree to
        them. We&apos;ve tried to write them in plain English; if
        anything reads as legalese, we&apos;ve probably failed and
        you should email us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>1. The service</h2>
      <p>
        FlashMind is a study app that lets you create decks of
        flashcards, schedule reviews using spaced repetition, and
        optionally use AI to generate card text and illustrations.
        We provide the platform; you provide the cards and the work
        of studying them.
      </p>

      <h2>2. Your account</h2>
      <p>
        You&apos;re responsible for keeping your sign-in credentials
        secure. If you suspect someone else has access to your
        account, change your auth method or contact us. We&apos;re
        not liable for losses caused by unauthorised access where
        you didn&apos;t reasonably protect the account.
      </p>
      <p>
        You must be at least 16 years old to use FlashMind. If we
        find out you&apos;re younger, we&apos;ll delete the account.
      </p>

      <h2>3. What you can and can&apos;t do</h2>
      <p>You can:</p>
      <ul>
        <li>Use FlashMind for your own personal study, in any subject.</li>
        <li>Generate AI illustrations for your cards within your credit allowance.</li>
        <li>Export your decks as Anki files at any time.</li>
        <li>Cancel your subscription whenever you like.</li>
      </ul>
      <p>You can&apos;t:</p>
      <ul>
        <li>Use the app to create or share content that&apos;s illegal, harmful, hateful, or violates someone else&apos;s rights.</li>
        <li>Try to break, scrape, reverse-engineer, or overload the service.</li>
        <li>Resell access to your account, or share it with multiple people as a way around the subscription model.</li>
        <li>Use AI features to generate content that violates our AI providers&apos; usage policies (Anthropic, FAL).</li>
      </ul>
      <p>
        We may suspend or terminate accounts that breach these
        rules, with notice where reasonable.
      </p>

      <h2>4. Subscriptions and payments</h2>
      <p>
        FlashMind has a free tier and paid Pro tiers (monthly and
        yearly). Pricing is shown on the{" "}
        <Link href="/pricing">pricing page</Link> and may change for
        future renewals — you&apos;ll get clear notice before any
        increase affects you.
      </p>
      <p>
        Payments are processed by Stripe. We don&apos;t see or store
        your card details. Subscriptions auto-renew at the end of
        each billing cycle until you cancel via Account → Manage
        billing.
      </p>

      <h3>Refunds</h3>
      <p>
        All sales are final once any AI image credits from a
        purchase have been used. Within seven days of a purchase,
        if you haven&apos;t used any of the credits or features
        from it, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for
        a full refund.
      </p>
      <p>
        For subscriptions: cancel any time. Your Pro features
        remain active until the end of the current billing period;
        we don&apos;t pro-rate partial months. Top-up credits you
        purchased separately stay in your account regardless of
        subscription status — they don&apos;t expire.
      </p>

      <h2>5. AI-generated content</h2>
      <p>
        AI-generated text and images are produced by third-party
        models (Anthropic, FAL). They&apos;re statistically
        plausible, not always factually correct, and we don&apos;t
        guarantee accuracy. <strong>Always verify important facts
        before relying on them</strong> — especially for medical,
        legal, financial, or safety-critical study material.
      </p>
      <p>
        Subject to applicable provider terms, you own the cards
        and images generated for your decks. If a generation goes
        wrong (the image isn&apos;t what you wanted), the
        feedback-for-regen flow lets you give us a written reason
        and try again on us.
      </p>

      <h2>6. Your content</h2>
      <p>
        You own the card text, hints, tags, and any images you
        upload. By using the service, you grant FlashMind a limited
        licence to store, process, and display that content
        <em>only</em> for the purpose of running the service for
        you. We don&apos;t use it to train AI models or share it
        with anyone except as described in our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <p>
        You&apos;re responsible for the content you create — make
        sure you have the right to use any text or images you
        upload, and that they don&apos;t infringe anyone
        else&apos;s rights.
      </p>

      <h2>7. The platform</h2>
      <p>
        The FlashMind app, design, code, brand, and underlying
        technology are ours. You can use them as a customer; you
        can&apos;t copy, redistribute, or build a competing
        product on top of them.
      </p>

      <h2>8. Service availability</h2>
      <p>
        We aim for high availability but don&apos;t promise 100%
        uptime. Maintenance windows and occasional outages are
        normal. We&apos;ll try to schedule disruptions for low-usage
        hours and post about them when we can. If a serious outage
        affects your paid service materially, contact us about a
        prorated credit.
      </p>

      <h2>9. Termination</h2>
      <p>
        You can delete your account any time via Account → Danger
        Zone. We can terminate accounts that breach these terms,
        attempt fraud, or chargeback in bad faith. On termination
        we&apos;ll remove your data within seven days, except where
        we&apos;re legally required to retain billing records.
      </p>

      <h2>10. Liability</h2>
      <p>
        FlashMind is provided &ldquo;as is&rdquo;. To the extent
        allowed by law, we&apos;re not liable for indirect,
        consequential, or speculative damages. Our maximum
        cumulative liability to you is capped at what you&apos;ve
        paid us in the 12 months before the issue arose, or USD $50
        if you haven&apos;t paid us anything. Nothing in these
        terms limits liability that can&apos;t legally be limited
        (e.g., for fraud or wilful misconduct).
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms — for new features, legal reasons,
        or to clarify something. If a change is material we&apos;ll
        email registered users with a summary at least 14 days before
        it takes effect, and update the &ldquo;last updated&rdquo;
        date here. Continuing to use the app after the effective
        date means you accept the new terms.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the laws of Jersey, Channel
        Islands. Any disputes that can&apos;t be resolved through
        normal support go to the Royal Court of Jersey, except where
        local consumer-protection law gives you stronger rights.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <hr className="my-10" />
      <p className="text-sm text-muted-foreground">
        See also: <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </article>
  );
}
