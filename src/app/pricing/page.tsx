"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";

const features = {
  free: [
    "Create unlimited decks and cards",
    "Spaced repetition with proven SM-2 algorithm",
    "Progress tracking and mastery statistics",
    "Import from CSV, TSV, XML, and more",
    "Upload your own images to cards",
    "Text-to-speech with language options",
    "Light and dark themes",
  ],
  pro: [
    "Everything in Free, plus:",
    "AI-powered flashcard generation",
    "AI illustration generation for cards",
    "Anki .apkg import and export",
    "Priority support from our team",
  ],
};

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{APP_NAME} Pricing</h1>
        <p className="text-muted-foreground">
          Start for free with no commitment. Upgrade whenever you're ready for more.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Tier */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Free</span>
              <span className="text-2xl font-bold">$0</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Forever free</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {features.free.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <svg className="h-5 w-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="w-full mt-6"
              onClick={() => router.push("/")}
            >
              Current Plan
            </Button>
          </CardContent>
        </Card>

        {/* Pro Tier */}
        <Card className="border-primary relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
            POPULAR
          </div>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Pro</span>
              <div className="text-right">
                <span className="text-2xl font-bold">$6.99</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              The complete AI-powered study experience
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {features.pro.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <svg className="h-5 w-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className={f.startsWith("Everything") ? "font-medium" : ""}>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              className="w-full mt-6"
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? "Loading..." : "Upgrade to Pro"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
