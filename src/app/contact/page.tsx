import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Contact · Huella",
};

const SUPPORT_EMAIL = "support@huella.app";

export default function ContactPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/account"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Account
        </Link>
        <h1 className="font-editorial text-3xl font-medium sm:text-4xl mt-1">Contact</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real human replies, usually within a day.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            For bug reports, feature requests, billing questions, or anything
            else — drop a line.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Helpful context to include</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            <li>What you were trying to do</li>
            <li>What happened instead</li>
            <li>Device + browser (e.g. iPhone 15, Safari)</li>
            <li>Screenshot if possible</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
