"use client";
import Link from "next/link";
import { useDeviceAccount } from "@/components/layout/device-provider";
export function SavedDataState({ error, retry }: { error?: string; retry: () => void }) {
  const { user, ready } = useDeviceAccount();
  if (ready && !user) return <Link href="/auth/login" className="text-sm text-primary underline">Sign in to see your saved data</Link>;
  return <div role="status" className="space-y-3 py-4">
    <p className="text-sm text-muted-foreground">{error || "Opening…"}</p>
    {error ? <button onClick={retry} className="text-sm text-primary underline">Try again</button> : <div aria-hidden className="space-y-2">{[0, 1, 2].map(n => <div key={n} className="h-14 rounded-lg bg-muted/50" />)}</div>}
  </div>;
}
