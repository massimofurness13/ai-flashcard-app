// Device-only storage, partitioned by account. No passwords or session tokens.
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
  const db = await deviceDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction("records").objectStore("records").get([owner, key]);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function writeRecord<T>(owner: string, key: string, value: T): Promise<void> {
  if (!owner) throw new Error("An account is required for device storage.");
  const db = await deviceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    tx.objectStore("records").put({ owner, key, value, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error("Device storage failed."));
  });
}
export async function listRecords(owner: string, prefix = ""): Promise<DeviceRecord<unknown>[]> {
  const db = await deviceDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction("records").objectStore("records").getAll(IDBKeyRange.bound([owner, prefix], [owner, `${prefix}\uffff`]));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function deleteRecord(owner: string, key: string): Promise<void> {
  const db = await deviceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    tx.objectStore("records").delete([owner, key]);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}
