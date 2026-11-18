"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearAudioMemory } from "@/lib/tts";
import { releaseMediaMemory, setDeviceOwner } from "@/lib/device-media";
import { flushReviews } from "@/lib/review-outbox";
import { DEVICE_IDENTITY_KEY, DEVICE_SIGN_OUT_KEY, observeDeviceIdentity, type DeviceIdentity } from "@/lib/device-identity";
import { STUDY_RESUME_KEY } from "@/lib/study-resume";

const DeviceContext = createContext<DeviceIdentity & { signOut: () => void }>({ user: null, ready: false, source: null, signOut: () => {} });
export const useDeviceAccount = () => useContext(DeviceContext);
export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<DeviceIdentity>({ user: null, ready: false, source: null });
  const observerRef = useRef<ReturnType<typeof observeDeviceIdentity> | null>(null);
  useEffect(() => {
    const client = createClient();
    let previousOwner: string | null | undefined;
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Private/storage-denied mode. */ }
    const observer = observeDeviceIdentity({
      auth: client.auth,
      storage,
      online: () => navigator.onLine,
      onAccountBoundary() {
        try { window.sessionStorage.removeItem(STUDY_RESUME_KEY); } catch { /* Storage unavailable. */ }
      },
      onChange(next) {
        const owner = next.user?.id ?? null;
        if (previousOwner !== owner) { clearAudioMemory(); releaseMediaMemory(); }
        previousOwner = owner;
        setDeviceOwner(owner);
        setIdentity(next);
      },
    });
    observerRef.current = observer;
    const refresh = () => { void observer.refresh(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const changed = (event: StorageEvent) => {
      if (event.storageArea === storage && (event.key === DEVICE_IDENTITY_KEY || event.key === DEVICE_SIGN_OUT_KEY || event.key === null)) observer.reloadSavedIdentity();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("storage", changed);
    document.addEventListener("visibilitychange", visible);
    return () => {
      observer.dispose();
      observerRef.current = null;
      window.removeEventListener("online", refresh);
      window.removeEventListener("storage", changed);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    const owner = identity.user?.id;
    if (!owner || identity.source !== "session") return;
    const sync = () => { if (navigator.onLine) void flushReviews(owner); };
    const visible = () => { if (document.visibilityState === "visible") sync(); };
    sync();
    const timer = window.setInterval(sync, 30000);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); window.removeEventListener("online", sync); document.removeEventListener("visibilitychange", visible); };
  }, [identity.user?.id, identity.source]);
  // Keyed subtree prevents the previous account's UI surviving a switch.
  return <DeviceContext.Provider value={{ ...identity, signOut: () => observerRef.current?.signOut() }}><div key={identity.user?.id ?? "signed-out"} className="contents">{children}</div></DeviceContext.Provider>;
}
