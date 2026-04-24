import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Help · FlashMind",
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is FlashMind?",
    a: "A flashcard app that generates a unique AI illustration for every card, because we remember images far better than plain text. Built on proven spaced-repetition (SM-2) so the right card shows up at the right time.",
  },
  {
    q: "How do I create a pack?",
    a: "Tap the + button on the home screen. You can create a pack manually, generate one from any text you paste with AI (Pro), or import from CSV, TSV, XML, or Anki.",
  },
  {
    q: "How do the AI image credits work?",
    a: "Every card can have a generated image. Quick (FLUX schnell) costs 1 credit, Premium (FLUX dev) costs 5 credits. Free accounts get 15 lifetime credits. Pro gets 500 credits every month plus any top-ups you buy — purchased credits never expire.",
  },
  {
    q: "Why do cards sometimes show the back first?",
    a: "Mixed mode — when a pack is set to Mixed orientation, half the cards start on the back and half on the front, randomly chosen at session start. Great for bidirectional language practice.",
  },
  {
    q: "What's the difference between Study and OmniReview?",
    a: "They're the same thing — one unified flow. Study runs across any set of packs with any filter (due / random / weakest / newest / etc.). SM-2 spaced repetition runs on every card you rate.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel in Account → Manage Subscription. Pro features stay until the end of your current billing period, and any purchased credits never expire.",
  },
  {
    q: "How do I delete my account?",
    a: "Account → Danger zone → Delete Account. This permanently wipes every pack, card, review, and subscription record. It cannot be undone.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/account"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Account
        </Link>
        <h1 className="text-2xl font-bold mt-1">Help</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Common questions. Still stuck? Head to{" "}
          <Link href="/contact" className="underline hover:text-foreground">
            Contact
          </Link>
          .
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq) => (
          <Card key={faq.q}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{faq.q}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{faq.a}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
