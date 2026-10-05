"use client";
import { useCallback, useEffect, useState } from "react";
import { useDeviceAccount } from "@/components/layout/device-provider";
import { readRecord, writeRecord, type DeviceRecord } from "@/lib/device-db";

const memory = new Map<string, DeviceRecord<unknown>>();
const requests = new Map<string, Promise<unknown>>();
export function invalidateDeviceQueries() {
  window.dispatchEvent(new Event("huella:data-changed"));
}
export function useDeviceQuery<T>(url: string, enabled = true) {
  const { user, ready } = useDeviceAccount();
  const owner = user?.id;
  const key = `${owner}:${url}`;
  const [result, setResult] = useState<{ key: string; data?: T; savedAt?: number; error?: string }>({ key });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(r => r + 1), []);
  useEffect(() => {
    if (!owner || !enabled) return;
    let active = true;
    let networkDone = false;
    const cached = memory.get(key) as DeviceRecord<T> | undefined;
    if (cached) setResult({ key, data: cached.value, savedAt: cached.savedAt });
    else void readRecord<T>(owner, `query:${url}`).then(record => {
      if (record && active && !networkDone) {
        memory.set(key, record);
        setResult(previous => ({ ...previous, key, data: record.value, savedAt: record.savedAt }));
      }
    }).catch(() => {});
    async function update() {
      try {
        let pending = requests.get(key) as Promise<T> | undefined;
        if (!pending) {
          pending = fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) }).then(async response => {
            if (!response.ok) throw new Error(response.status === 401 ? "Sign in again to sync." : "Couldn’t refresh. Showing saved data when available.");
            return response.json() as Promise<T>;
          }).finally(() => requests.delete(key));
          requests.set(key, pending);
        }
        const data = await pending;
        networkDone = true;
        if (!active) return;
        const record = { owner: owner!, key: `query:${url}`, value: data, savedAt: Date.now() };
        memory.set(key, record);
        setResult({ key, data, savedAt: record.savedAt });
        await writeRecord(owner!, record.key, data).catch(() => {});
      } catch (error) {
        if (active) setResult(previous => ({ ...(previous.key === key ? previous : { key }), error: error instanceof Error ? error.message : "Waiting for connection." }));
      }
    }
    void update();
    const visible = () => { if (document.visibilityState === "visible") void update(); };
    window.addEventListener("online", update);
    window.addEventListener("huella:data-changed", update);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.removeEventListener("online", update);
      window.removeEventListener("huella:data-changed", update);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [owner, url, enabled, key, revision]);
  const current = result.key === key ? result : { key };
  const cached = memory.get(key) as DeviceRecord<T> | undefined;
  return { data: enabled && owner ? current.data ?? cached?.value : undefined, error: current.error, savedAt: current.savedAt ?? cached?.savedAt, ready, refresh };
}
