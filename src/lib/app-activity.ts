import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

type Activity = { active: boolean; generation: number };
const initial: Activity = { active: true, generation: 0 };
let snapshot = initial;
let installed = false, revision = 0;
let nativeActive: boolean | undefined;
const listeners = new Set<() => void>();
export const getAppActivity = () => snapshot;
export const getServerAppActivity = () => initial;
function publish(active: boolean) {
  revision++;
  if (snapshot.active === active) return;
  snapshot = { active, generation: snapshot.generation + (active ? 1 : 0) };
  for (const listener of listeners) listener();
}
export function subscribeAppActivity(listener: () => void): () => void {
  listeners.add(listener);
  if (!installed && typeof document !== "undefined") {
    installed = true;
    const visible = () => publish(nativeActive ?? document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pagehide", () => publish(false));
    window.addEventListener("pageshow", visible);
    visible();
    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({isActive}) => { nativeActive = isActive; publish(isActive); }).catch(() => {});
      const queriedAt = revision;
      void App.getState().then(({isActive}) => {
        if (queriedAt !== revision) return;
        nativeActive = isActive; publish(isActive);
      }).catch(() => {});
    }
  }
  return () => { listeners.delete(listener); };
}
