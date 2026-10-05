"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { clearAudioMemory } from "@/lib/tts";
import { releaseMediaMemory, setDeviceOwner } from "@/lib/device-media";
import { flushReviews } from "@/lib/review-outbox";

const DeviceContext = createContext<{ user: User | null; ready: boolean }>({ user: null, ready: false });
export const useDeviceAccount = () => useContext(DeviceContext);
export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: false });
  useEffect(() => {
    const client = createClient();
    let active = true;
    let authEventReceived = false;
    let previousOwner: string | undefined;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (previousOwner !== session?.user.id) { clearAudioMemory(); releaseMediaMemory(); }
      previousOwner = session?.user.id;
      setDeviceOwner(session?.user.id ?? null);
      authEventReceived = true;
      if (active) setIdentity({ user: session?.user ?? null, ready: true });
    });
    void client.auth.getSession().then(({ data }) => {
      if (active && !authEventReceived) { setDeviceOwner(data.session?.user.id ?? null); setIdentity({ user: data.session?.user ?? null, ready: true }); }
    }).catch(() => { if (active && !authEventReceived) setIdentity({ user: null, ready: true }); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    const owner = identity.user?.id;
    if (!owner) return;
    const sync = () => { void flushReviews(owner); };
    const visible = () => { if (document.visibilityState === "visible") sync(); };
    sync();
    const timer = window.setInterval(sync, 30000);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); window.removeEventListener("online", sync); document.removeEventListener("visibilitychange", visible); };
  }, [identity.user?.id]);
  // Keyed subtree prevents the previous account's UI surviving a switch.
  return <DeviceContext.Provider value={identity}><div key={identity.user?.id ?? "signed-out"} className="contents">{children}</div></DeviceContext.Provider>;
}
