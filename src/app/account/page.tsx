"use client";
import { invalidateDeviceQueries } from "@/hooks/use-device-query";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDeviceAccount } from "@/components/layout/device-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { CARDS_PER_SESSION_OPTIONS, AUTO_FLIP_MAX, CARD_ORIENTATION_OPTIONS, FONT_SIZE_OPTIONS } from "@/lib/constants";
import { readDeviceSettings, updateDeviceSettings } from "@/lib/device-settings";
import { speak } from "@/lib/tts";
import { DailyGoalCard } from "@/components/account/daily-goal-card";
import { DangerZoneCard } from "@/components/account/danger-zone-card";
import { ReminderCard } from "@/components/account/reminder-card";
import { SettingsSection } from "@/components/account/settings-section";

export default function AccountPage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { user } = useDeviceAccount();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [countDraft, setCountDraft] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    // Hydrate browser-only preferences after the server/client initial render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(readDeviceSettings());
  }, []);
  const speed = Number(settings.ttsSpeed ?? 1);
  const count = Number(settings.defaultCards ?? 10);
  const flip = Number(settings.defaultAutoFlip ?? 0);
  const advance = Number(settings.defaultAutoAdvance ?? 0);
  const orientation = String(settings.defaultOrientation ?? "front");
  const fontSize = String(settings.fontSize ?? "medium");
  function save(patch: Record<string, unknown>) {
    setSettings(previous => ({ ...previous, ...patch }));
    setSaveError(!updateDeviceSettings(patch));
  }
  function changeFont(value: string) {
    document.body.classList.remove("font-small", "font-medium", "font-large", "font-xlarge");
    document.body.classList.add(`font-${value}`);
    save({ fontSize: value });
  }
  async function logout() {
    await createClient().auth.signOut();
    router.push("/auth/login");
    invalidateDeviceQueries();
    router.refresh();
  }
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0];
  return <div className="max-w-2xl space-y-5">
    <h1 className="font-editorial text-3xl font-medium">Settings</h1>
    {user && <div className="flex items-center gap-3">
      <div aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-editorial text-xl text-primary">{name?.[0]?.toUpperCase()}</div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div>
      <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
    </div>}
    {saveError && <p role="alert" className="text-sm text-destructive">Your device couldn’t save this setting. Check available storage and try again.</p>}
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <SettingsSection title="Study" summary="Session length, timers and card order">
        <label className="block text-sm font-medium" htmlFor="default-card-count">Cards per session</label>
        <div className="flex flex-wrap gap-2">
          {CARDS_PER_SESSION_OPTIONS.map(n => <Button key={n} size="sm" variant={count === n ? "default" : "outline"} onClick={() => { setCountDraft(null); save({ defaultCards: n }); }}>{n}</Button>)}
          <Input id="default-card-count" aria-label="Custom cards per session" type="number" min={1} max={1000} value={countDraft ?? String(count)} onChange={e => { setCountDraft(e.target.value); const n = Number(e.target.value); if (n >= 1 && n <= 1000) save({ defaultCards: Math.floor(n) }); }} onBlur={() => setCountDraft(null)} className="w-24" />
        </div>
        {([{ key: "defaultAutoFlip", label: "Auto-flip", value: flip }, { key: "defaultAutoAdvance", label: "Auto-advance", value: advance }] as const).map(timer => <div key={timer.key}>
          <label htmlFor={timer.key} className="flex justify-between text-sm mb-2"><span>{timer.label}</span><span className="tabular-nums text-muted-foreground">{timer.value === 0 ? "Off" : `${timer.value.toFixed(1)}s`}</span></label>
          <input id={timer.key} type="range" min={0} max={AUTO_FLIP_MAX} step={0.1} value={timer.value} onChange={e => save({ [timer.key]: Number(e.target.value) })} className="w-full" />
        </div>)}
        <p className="text-xs text-muted-foreground">1 second recommended. Timers start after the audio.</p>
        <p className="text-sm font-medium">Show first</p>
        <div className="flex flex-wrap gap-2">{CARD_ORIENTATION_OPTIONS.map(o => <Button key={o.value} size="sm" variant={orientation === o.value ? "default" : "outline"} onClick={() => save({ defaultOrientation: o.value })}>{o.label}</Button>)}</div>
      </SettingsSection>
      <SettingsSection title="Audio" summary={`${speed.toFixed(1)}× playback speed`}>
        <label htmlFor="voice-speed" className="flex justify-between text-sm"><span>Playback speed</span><span>{speed.toFixed(1)}×</span></label>
        <input id="voice-speed" className="w-full" type="range" min={0.5} max={2} step={0.1} value={speed} onChange={e => save({ ttsSpeed: Number(e.target.value) })} />
        <Button size="sm" variant="outline" onClick={() => speak("This is a sample at your selected speed.", { languageCode: "en-GB" })}>Play sample</Button>
        <p className="text-xs text-muted-foreground">Choose each language’s voice in Pack settings.</p>
      </SettingsSection>
      <SettingsSection title="Daily goal" summary="Choose your daily card target"><DailyGoalCard /></SettingsSection>
      <SettingsSection title="Reminders" summary="When to remind you to study"><ReminderCard /></SettingsSection>
      <SettingsSection title="Appearance" summary="Theme and text size">
        <p className="text-sm font-medium">Theme</p>
        <div className="flex flex-wrap gap-2">{["light", "dark", "system"].map(value => <Button key={value} size="sm" variant={theme === value ? "default" : "outline"} onClick={() => setTheme(value)} className="capitalize">{value}</Button>)}</div>
        <p className="text-sm font-medium">Text size</p>
        <div className="flex flex-wrap gap-2">{FONT_SIZE_OPTIONS.map(o => <Button key={o.value} size="sm" variant={fontSize === o.value ? "default" : "outline"} onClick={() => changeFont(o.value)}>{o.label}</Button>)}</div>
      </SettingsSection>
    </div>
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {[{ href: "/account/billing", label: "Plan & credits" }, { href: "/usage", label: "Credit usage" }, { href: "/account/downloads", label: "Device storage" }, { href: "/help", label: "Help & support" }].map(item => <Link key={item.href} href={item.href} className="flex min-h-12 items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40">{item.label}<span aria-hidden className="text-muted-foreground">›</span></Link>)}
    </div>
    <div className="overflow-hidden rounded-xl border border-border bg-card"><SettingsSection title="Delete account" summary="Permanently remove your account"><DangerZoneCard /></SettingsSection></div>
    <p className="text-center text-xs text-muted-foreground">Huella · build {process.env.NEXT_PUBLIC_BUILD_SHA}</p>
  </div>;
}
