"use client";
import { useCallback, useEffect, useState } from "react";
import { projectLocalProgress } from "@/lib/local-progress";
import { useDeviceAccount } from "@/components/layout/device-provider";
import { readRecord, writeRecord, listRecords, type DeviceRecord } from "@/lib/device-db";
import {deviceQueryError,QueryRefreshError} from "@/lib/device-query-error";

const memory = new Map<string, DeviceRecord<unknown>>();
const requests = new Map<string, Promise<unknown>>();
export function invalidateDeviceQueries() {
  window.dispatchEvent(new Event("huella:data-changed"));
}
export function useDeviceQuery<T>(url: string, enabled = true) {
  const { user, ready, source } = useDeviceAccount();
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
    if (cached) void projectLocalProgress(owner,url,cached.value,cached.savedAt).then(data=>{if(active)setResult({key,data,savedAt:cached.savedAt});});
    else void readRecord<T>(owner, `query:${url}`).then(async record => {
      if (record && active && !networkDone) {
        memory.set(key, record);
        const data = await projectLocalProgress(owner,url,record.value,record.savedAt);
        if(active&&!networkDone)setResult(previous => ({ ...previous, key, data, savedAt: record.savedAt }));
      }
    }).catch(() => {});
    async function update() {
      if (navigator.onLine === false) return;
      try {
      // Keep the server baseline stable while local reviews are unacknowledged.
      // Otherwise a fresh timestamp would hide those locally saved ratings.
      if ((url === "/api/library" || url.startsWith("/api/stats")) &&
          (await listRecords(owner!, "review:")).length && await readRecord(owner!,`query:${url}`)) return;
        let pending = requests.get(key) as Promise<T> | undefined;
        if (!pending) {
          pending = fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) }).then(async response => {
            if (!response.ok) throw new QueryRefreshError(response.status === 401 ? "Showing saved data. Reconnect in Account to sync updates." : "Couldn’t refresh. Showing saved data when available.");
            return response.json() as Promise<T>;
          }).finally(() => requests.delete(key));
          requests.set(key, pending);
        }
        const data = await pending;
        networkDone = true;
        if (!active) return;
        const record = { owner: owner!, key: `query:${url}`, value: data, savedAt: Date.now() };
        memory.set(key, record);
        const projected = await projectLocalProgress(owner!,url,data,record.savedAt);
        if(active)setResult({ key, data:projected, savedAt: record.savedAt });
        await writeRecord(owner!, record.key, data).catch(() => {});
      } catch (error) {
        if (active) setResult(previous => ({ ...(previous.key === key ? previous : { key }), error: deviceQueryError(error) }));
      }
    }
    const saved = async (event: Event) => {
      const detail = (event as CustomEvent<{owner:string;url:string}>).detail;
      if (detail?.owner !== owner || detail.url !== url) return;
      const record = await readRecord<T>(owner!, `query:${url}`);
      if (record && active) { memory.set(key,record); const data=await projectLocalProgress(owner!,url,record.value,record.savedAt); if(active)setResult({key,data,savedAt:record.savedAt}); }
    };
    const local=()=>{void saved(new CustomEvent("huella:device-saved",{detail:{owner,url}}));};
    window.addEventListener("huella:outbox",local);
    window.addEventListener("huella:device-saved",saved);
    void update();
    const visible = () => { if (document.visibilityState === "visible") void update(); };
    window.addEventListener("online", update);
    window.addEventListener("huella:data-changed", update);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.removeEventListener("huella:device-saved",saved);
      window.removeEventListener("huella:outbox",local);
      window.removeEventListener("online", update);
      window.removeEventListener("huella:data-changed", update);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [owner, url, enabled, key, revision, source]);
  const current = result.key === key ? result : { key };
  const cached = memory.get(key) as DeviceRecord<T> | undefined;
  return { data: enabled && owner ? current.data ?? cached?.value : undefined, error: current.error, savedAt: current.savedAt ?? cached?.savedAt, ready, refresh };
}
