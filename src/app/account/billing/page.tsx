import Link from "next/link";
import { AccountInfoCard } from "@/components/account/account-info-card";
import { ImageQuotaCard } from "@/components/subscription/image-quota-card";

export default function BillingPage() {
  return <div className="max-w-2xl space-y-4">
    <Link href="/account" className="text-sm text-muted-foreground">‹ Settings</Link>
    <h1 className="font-editorial text-3xl">Plan &amp; credits</h1>
    <AccountInfoCard />
    <ImageQuotaCard />
    <Link href="/usage" className="flex min-h-12 items-center justify-between border-b border-border text-sm font-medium">Credit usage <span aria-hidden>›</span></Link>
  </div>;
}
