"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  CARDS_PER_SESSION_OPTIONS,
  AUTO_FLIP_MAX,
  CARD_ORIENTATION_OPTIONS,
  FONT_SIZE_OPTIONS,
} from "@/lib/constants";
import { ImageQuotaCard } from "@/components/subscription/image-quota-card";
import { DailyGoalCard } from "@/components/account/daily-goal-card";

export default function AccountPage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [defaultCards, setDefaultCards] = useState(10);
  const [customCards, setCustomCards] = useState("");
  const [isCustomCards, setIsCustomCards] = useState(false);
  const [defaultAutoFlip, setDefaultAutoFlip] = useState(0);
  const [defaultOrientation, setDefaultOrientation] = useState("front");
  const [fontSize, setFontSize] = useState("medium");

  useEffect(() => {
    setMounted(true);

    // Load user info
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Load TTS voices
    function loadVoices() {
      const v = window.speechSynthesis?.getVoices() || [];
      setVoices(v);
    }
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);

    // Load saved settings from localStorage
    const saved = localStorage.getItem("flashmind-settings");
    if (saved) {
      const settings = JSON.parse(saved);
      setSelectedVoice(settings.voice || "");
      setTtsSpeed(settings.ttsSpeed || 1);
      setDefaultCards(settings.defaultCards || 10);
      setDefaultAutoFlip(settings.defaultAutoFlip || 0);
      setDefaultOrientation(settings.defaultOrientation || "front");
      if (settings.fontSize) {
        setFontSize(settings.fontSize);
        applyFontSize(settings.fontSize);
      }
    }

    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  function saveSettings() {
    localStorage.setItem(
      "flashmind-settings",
      JSON.stringify({
        voice: selectedVoice,
        ttsSpeed,
        defaultCards,
        defaultAutoFlip,
        defaultOrientation,
        fontSize,
      })
    );
  }

  function applyFontSize(size: string) {
    document.body.classList.remove("font-small", "font-medium", "font-large", "font-xlarge");
    document.body.classList.add(`font-${size}`);
  }

  function handleFontSize(size: string) {
    setFontSize(size);
    applyFontSize(size);
    // Save inline since setState is async
    localStorage.setItem(
      "flashmind-settings",
      JSON.stringify({
        voice: selectedVoice,
        ttsSpeed,
        defaultCards,
        defaultAutoFlip,
        defaultOrientation,
        fontSize: size,
      })
    );
  }

  function testVoice() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("This is a test of the text to speech voice.");
    utterance.rate = ttsSpeed;
    const voice = voices.find((v) => v.name === selectedVoice);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (!mounted) return null;

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";

  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Account & Settings</h1>

      {/* User Profile */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-16 w-16 rounded-full"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                  {displayName[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold">{displayName}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleLogout}
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Free Plan</p>
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro to unlock AI generation, AI images, and Anki import/export
              </p>
            </div>
            <Button
              onClick={async () => {
                const res = await fetch("/api/stripe/checkout", { method: "POST" });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              }}
            >
              Upgrade to Pro
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI image quota + credit top-ups */}
      <ImageQuotaCard />

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Theme</label>
            <div className="flex gap-2">
              {[
                { label: "Light", value: "light" },
                { label: "Dark", value: "dark" },
                { label: "System", value: "system" },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  variant={theme === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Font Size</label>
            <div className="flex gap-2">
              {FONT_SIZE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={fontSize === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFontSize(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily study goal */}
      <DailyGoalCard />

      {/* Default Review Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Default Review Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Cards per session</label>
            <div className="flex gap-2 flex-wrap">
              {CARDS_PER_SESSION_OPTIONS.map((n) => (
                <Button
                  key={n}
                  variant={!isCustomCards && defaultCards === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setDefaultCards(n); setIsCustomCards(false); setCustomCards(""); saveSettings(); }}
                >
                  {n}
                </Button>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  placeholder="Custom"
                  value={customCards}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomCards(val);
                    const num = parseInt(val, 10);
                    if (num > 0) {
                      setDefaultCards(num);
                      setIsCustomCards(true);
                      saveSettings();
                    }
                  }}
                  className="w-24 h-8 text-sm"
                  min={1}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Auto-flip timer: {defaultAutoFlip === 0 ? "Off" : `${defaultAutoFlip.toFixed(1)}s`}
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Off</span>
              <input
                type="range"
                min={0}
                max={AUTO_FLIP_MAX}
                step={0.1}
                value={defaultAutoFlip}
                onChange={(e) => { setDefaultAutoFlip(parseFloat(e.target.value)); saveSettings(); }}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">{AUTO_FLIP_MAX}s</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Card orientation</label>
            <div className="flex gap-2">
              {CARD_ORIENTATION_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={defaultOrientation === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setDefaultOrientation(opt.value); saveSettings(); }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TTS Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Text-to-Speech</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Voice</label>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedVoice}
              onChange={(e) => {
                setSelectedVoice(e.target.value);
                saveSettings();
              }}
            >
              <option value="">Default</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Speed: {ttsSpeed}x
            </label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={ttsSpeed}
              onChange={(e) => {
                setTtsSpeed(parseFloat(e.target.value));
                saveSettings();
              }}
              className="w-full"
            />
          </div>

          <Button variant="outline" onClick={testVoice}>
            Test Voice
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
