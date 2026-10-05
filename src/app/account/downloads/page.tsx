"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useDeviceAccount } from "@/components/layout/device-provider";
import { listRecords, deleteRecord } from "@/lib/device-db";
import { releaseMediaMemory } from "@/lib/device-media";
import { clearAudioMemory } from "@/lib/tts";
import { flushReviews, type PendingReview } from "@/lib/review-outbox";
import { Button } from "@/components/ui/button";
export default function DownloadsPage() {
  const { user } = useDeviceAccount();
  const [usage, setUsage] = useState({ files: 0, bytes: 0, reviews: 0, errors: 0 });
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const records = await listRecords(user.id);
      const media = records.filter(r => r.key.startsWith("media:"));
      const reviews = records.filter(r => r.key.startsWith("review:"));
      setUsage({ files: media.length, bytes: media.reduce((sum, r) => sum + (r.value as Blob).size, 0), reviews: reviews.length, errors: reviews.filter(r => (r.value as PendingReview).error).length });
    } catch { setMessage("Device storage is unavailable."); }
  }, [user]);
  useEffect(() => {
    // External IndexedDB snapshot is read asynchronously inside refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    window.addEventListener("huella:outbox", refresh);
    return () => window.removeEventListener("huella:outbox", refresh);
  }, [refresh]);
  async function clearDownloads() {
    if (!user || !window.confirm("Remove downloaded audio and images from this device? Your cloud packs and pending reviews will stay safe.")) return;
    try {
      clearAudioMemory(); releaseMediaMemory();
      for (const record of await listRecords(user.id)) if (/^(media:|pack:)/.test(record.key)) await deleteRecord(user.id, record.key);
      setMessage("Downloads removed from this device. Cloud originals are unchanged.");
      await refresh();
    } catch { setMessage("Some files couldn't be removed. Try again."); }
  }
  return <div className="max-w-xl space-y-4">
    <Link href="/account" className="text-sm text-muted-foreground">‹ Settings</Link>
    <h1 className="font-editorial text-3xl">Device storage</h1>
    <div className="rounded-xl border border-border bg-card divide-y divide-border">
      <div className="p-4 flex justify-between"><span>Saved media</span><strong>{usage.files} files · {(usage.bytes / 1048576).toFixed(1)} MB</strong></div>
      <div className="p-4 flex justify-between"><span>Reviews waiting to sync</span><strong>{usage.reviews}</strong></div>
    </div>
    <p className="text-sm text-muted-foreground">Viewed artwork and played audio are saved automatically. Use “Save audio &amp; images” inside a pack to prepare all its media.</p>
    <p className="text-sm text-muted-foreground">Saved data stays on this device, separate for each account. The app still needs a connection to open pages that aren’t available locally.</p>
    {usage.errors > 0 && <p role="alert" className="text-sm text-destructive">{usage.errors} review(s) need attention—for example, the card was deleted on another device. They have been retained here.</p>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => user && void flushReviews(user.id)}>Sync reviews now</Button><Button variant="outline" onClick={clearDownloads}>Remove media downloads</Button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
