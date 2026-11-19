"use client";

import { useEffect } from "react";

// Keep aligned with the audited public documents in public/sw.js.
const SHELL_ROUTES = new Set(["/", "/study", "/study/session", "/account", "/account/downloads", "/stats", "/decks/offline"]);

export interface AppShellResult {
  type: "APP_SHELL_RESULT";
  ready: boolean;
  build?: string;
  routes?: string[];
}

let preparation: Promise<AppShellResult> | null = null;

/** Also used by automatic study preparation; readiness means all shell assets saved. */
export function prepareAppShell(): Promise<AppShellResult> {
  if (preparation) return preparation;
  preparation = (async (): Promise<AppShellResult> => {
    const unavailable: AppShellResult = { type: "APP_SHELL_RESULT", ready: false };
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return unavailable;
    try {
      // Recheck the worker script without the HTTP cache; no forced page reload
      // on activation, which would lose an in-progress answer/session.
      const registration = navigator.onLine
        ? await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        : await navigator.serviceWorker.getRegistration("/");
      if (!registration) return unavailable;
      return await new Promise<AppShellResult>((resolve) => {
        const channel = new MessageChannel();
        let settled = false;
        const worker = registration.installing || registration.waiting || registration.active;
        const finish = (result: AppShellResult) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          worker?.removeEventListener("statechange", send);
          channel.port1.close();
          resolve(result);
        };
        const timeout = window.setTimeout(() => finish(unavailable), 60000);
        channel.port1.onmessage = event => {
          if (event.data?.type === "APP_SHELL_RESULT") finish(event.data);
        };
        function send() {
          if (settled || !worker) return;
          if (worker.state === "redundant") { finish(unavailable); return; }
          if (worker.state !== "activated") return;
          worker.removeEventListener("statechange", send);
          try {
            worker.postMessage({ type: navigator.onLine ? "PREPARE_APP_SHELL" : "CHECK_APP_SHELL" }, [channel.port2]);
          } catch { finish(unavailable); }
        }
        if (!worker) finish(unavailable);
        else { worker.addEventListener("statechange", send); send(); }
      });
    } catch { return unavailable; }
  })().finally(() => { preparation = null; });
  return preparation;
}

/**
 * Prepare anonymous app documents automatically, including routes the user
 * hasn't visited. Account data/media preparation is owned by the device layer.
 */
export function MediaServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;
    const prepare = () => {
      void prepareAppShell().then(result => {
        if (active) window.dispatchEvent(new CustomEvent("huella:app-shell", { detail: result }));
      });
    };
    const offlineLink = (event: MouseEvent) => {
      if (navigator.onLine || event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.hasAttribute("download") ||
          (target.target && target.target !== "_self")) return;
      const url = new URL(target.href);
      if (url.origin !== window.location.origin || !(SHELL_ROUTES.has(url.pathname) || (url.pathname !== "/decks/new" && /^\/decks\/[a-zA-Z0-9_-]+$/.test(url.pathname))) ||
          (url.pathname === window.location.pathname && url.search === window.location.search && url.hash)) return;
      // Capture before Next Link's handler. A document navigation reaches the
      // prepared shell while retaining session options in location.search.
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(url.href);
    };
    prepare();
    window.addEventListener("online", prepare);
    navigator.serviceWorker.addEventListener("controllerchange", prepare);
    document.addEventListener("click", offlineLink, true);
    return () => {
      active = false;
      window.removeEventListener("online", prepare);
      navigator.serviceWorker.removeEventListener("controllerchange", prepare);
      document.removeEventListener("click", offlineLink, true);
    };
  }, []);
  return null;
}
