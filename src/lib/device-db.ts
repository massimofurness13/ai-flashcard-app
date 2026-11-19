import { isNativeDevice, NativeStore, encodeNativeValue, decodeNativeRecord } from "./native-device";
// Device-only storage, partitioned by account. No passwords or session tokens.
// The installed app uses SQLite in Application Support; browsers use IndexedDB.
let connection: Promise<IDBDatabase> | undefined;
export function deviceDB(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("huella-device-v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("records", { keyPath: ["owner", "key"] });
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Device storage is busy in another tab."));
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); connection = undefined; };
      resolve(request.result);
    };
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}
export interface DeviceRecord<T> { owner: string; key: string; value: T; savedAt: number }
export async function readRecord<T>(owner: string, key: string): Promise<DeviceRecord<T> | undefined> {
  if (isNativeDevice()) return decodeNativeRecord<T>((await NativeStore.read({owner,key})).record);
  const db = await deviceDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction("records").objectStore("records").get([owner, key]);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function writeRecord<T>(owner: string, key: string, value: T): Promise<void> {
  if (!owner) throw new Error("An account is required for device storage.");
  if (isNativeDevice()) return NativeStore.write({owner,records:[{key,value:await encodeNativeValue(value)}]});
  const db = await deviceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    tx.objectStore("records").put({ owner, key, value, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error("Device storage failed."));
  });
}
export async function listRecords(owner: string, prefix = ""): Promise<DeviceRecord<unknown>[]> {
  if (isNativeDevice()) return (await NativeStore.list({owner,prefix})).records.map(record=>decodeNativeRecord(record)!);
  const db = await deviceDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction("records").objectStore("records").getAll(IDBKeyRange.bound([owner, prefix], [owner, `${prefix}\uffff`]));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function deleteRecord(owner: string, key: string): Promise<void> {
  if (isNativeDevice()) return NativeStore.remove({owner,key});
  const db = await deviceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    tx.objectStore("records").delete([owner, key]);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

/** Commit a review and its session cursor together, including on sudden app termination. */
export async function writeRecords(owner: string, records: { key: string; value: unknown; savedAt?: number }[]): Promise<void> {
  if (!owner) throw new Error("An account is required for device storage.");
  if (isNativeDevice()) return NativeStore.write({owner,records:await Promise.all(records.map(async r=>({...r,value:await encodeNativeValue(r.value)})))});
  const db = await deviceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    try {
      for (const record of records) tx.objectStore("records").put({owner, ...record, savedAt: record.savedAt ?? Date.now()});
    } catch (error) { tx.abort(); reject(error); return; }
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error("Device storage failed."));
  });
}
