import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · FlashMind",
  description:
    "How FlashMind collects, uses, and protects your data — written in plain English.",
};

const LAST_UPDATED = "28 April 2026";
const SUPPORT_EMAIL = "support@flashmind.app";

export default function PrivacyPolicyPage() {
  return (
    <article className="legal-page max-w-3xl mx-auto">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          FlashMind
        </p>
        <h1 className="font-editorial text-4xl font-medium mt-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <p>
        This is our plain-English summary of what data FlashMind
        collects, why, and what we do with it. We&apos;ve tried to make it
        readable. If anything is unclear, email us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and
        we&apos;ll explain.
      </p>

      <h2>Who we are</h2>
      <p>
        FlashMind is a personal study app — flashcards with spaced
        repetition, AI-generated illustrations, and audio. It&apos;s
        operated by the FlashMind team. References to &ldquo;we&rdquo;,
        &ldquo;us&rdquo;, or &ldquo;FlashMind&rdquo; in this policy mean the same thing.
      </p>

      <h2>What we collect</h2>

      <h3>Account information</h3>
      <p>
        When you sign up, we store the email address you used and, if
        you signed in via Google, your name and profile picture URL.
        That&apos;s it from auth. We never see or store your password
        because authentication runs through Supabase.
      </p>

      <h3>Your content</h3>
      <p>
        Decks, cards, hints, tags, uploaded images, and AI-generated
        images you create. This content stays private to your account
        — other users can&apos;t see it. You can export or delete
        any of it from inside the app.
      </p>

      <h3>Study activity</h3>
      <p>
        We store every card review (whether you marked it Again, Good,
        or Easy, and when), your daily goal, your streak count, and
        your settings. The spaced-repetition algorithm needs this
        data to schedule reviews; we also use it to show you stats.
      </p>

      <h3>Subscription & payment data</h3>
      <p>
        If you upgrade, we store a Stripe customer ID and subscription
        status. We <strong>never</strong> see or store your card
        number, CVV, or bank details — those go directly to Stripe.
        See <a href="https://stripe.com/privacy">Stripe&apos;s privacy
        policy</a> for how they handle that.
      </p>

      <h3>Push notification tokens</h3>
      <p>
        If you enable daily study reminders, your browser gives us a
        push subscription token (an opaque endpoint URL). We use it
        only to send the reminder you asked for. Disabling reminders
        in the app removes the token immediately.
      </p>

      <h3>Technical data</h3>
      <p>
        Standard server logs (IP address, user agent, request paths)
        kept for up to 30 days for security and debugging. Errors are
        sent to Sentry — these reports include the URL you were on
        and a stack trace, but exclude form contents and personal
        data. We don&apos;t use advertising or analytics trackers.
      </p>

      <h2>Why we collect it</h2>
      <p>To do these things, in this order of importance:</p>
      <ol>
        <li>Run the product you signed up for (your decks, cards, study scheduling, AI features).</li>
        <li>Process your subscription if you have one.</li>
        <li>Keep the service secure and debug problems when they happen.</li>
        <li>Send you reminders, but only if you asked for them.</li>
        <li>Communicate with you about your account when necessary.</li>
      </ol>
      <p>
        We don&apos;t sell your data, ever. We don&apos;t train AI
        models on your card content. We don&apos;t share it with
        advertisers.
      </p>

      <h2>Who we share data with</h2>
      <p>
        FlashMind uses a small set of well-known infrastructure
        providers to run the product. Your data is shared with them
        only to the extent the product needs:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — hosts our database, authentication,
          and uploaded image storage. Located in the EU.
        </li>
        <li>
          <strong>Render</strong> — hosts the application servers.
        </li>
        <li>
          <strong>Stripe</strong> — processes payments and subscriptions.
        </li>
        <li>
          <strong>Anthropic (Claude)</strong> — processes the front and
          back of cards when you ask the app to generate text or
          interpret card content for AI illustration. Anthropic does
          not retain or train on this content per their API terms.
        </li>
        <li>
          <strong>FAL</strong> — runs the AI image generation models we
          use for card illustrations.
        </li>
        <li>
          <strong>Google Cloud Text-to-Speech</strong> — generates the
          native-speaker audio for cards with a configured language.
          Audio files are cached in our Supabase bucket so the same
          phrase isn&apos;t sent more than once.
        </li>
        <li>
          <strong>Sentry</strong> — receives error reports from
          production crashes, with PII filtering enabled.
        </li>
      </ul>
      <p>
        Each of these providers has their own privacy policy and
        security practices. We pick them carefully but we don&apos;t
        control what they do beyond what their terms say.
      </p>

      <h2>Cookies</h2>
      <p>
        We set one essential cookie group: the Supabase authentication
        cookies that keep you logged in. We don&apos;t set advertising
        cookies, analytics cookies, or third-party tracking pixels.
        Stripe and Sentry may set their own cookies on the parts of
        the site they touch (the checkout window, error reporting),
        per their respective policies.
      </p>

      <h2>How long we keep things</h2>
      <p>
        Your account data — decks, cards, reviews, settings — is kept
        as long as your account exists. Deleting your account from
        Account → Danger Zone permanently removes all of it within
        seven days. Server logs and error reports are kept for up
        to 30 days. Stripe holds billing records for as long as their
        regulations require.
      </p>

      <h2>Your rights</h2>
      <p>If you&apos;re in a jurisdiction with data-protection laws (UK GDPR, EU GDPR, California, etc.), you have the right to:</p>
      <ul>
        <li>Access the data we hold about you.</li>
        <li>Correct it if it&apos;s wrong.</li>
        <li>Delete your account and everything tied to it.</li>
        <li>Export your card content (Anki .apkg export is built into the app).</li>
        <li>Object to specific processing.</li>
      </ul>
      <p>
        To exercise any of these, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We
        respond within 30 days, usually faster.
      </p>

      <h2>Children</h2>
      <p>
        FlashMind is intended for users aged 16 and over. If you
        believe a child has signed up, please email us and we&apos;ll
        delete the account.
      </p>

      <h2>International transfers</h2>
      <p>
        Some of our providers (Anthropic, FAL, Render) operate
        primarily from the United States, which means your data may be
        processed there. We rely on standard contractual clauses and
        each provider&apos;s own compliance certifications.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change anything material, we&apos;ll update the &ldquo;last
        updated&rdquo; date at the top and email registered users a
        plain-English summary of what changed. Minor wording fixes
        won&apos;t trigger an email.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, complaints, or requests:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <hr className="my-10" />
      <p className="text-sm text-muted-foreground">
        See also: <Link href="/terms">Terms of Service</Link>.
      </p>
    </article>
  );
}
