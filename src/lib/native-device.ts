import { Capacitor, registerPlugin } from "@capacitor/core";

/** Native storage is available only in the installed, bundled app. */
export const isNativeDevice = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("NativeStore");
export interface NativeRecord { owner: string; key: string; value: unknown; savedAt: number }
export const NativeStore = registerPlugin<{
  summary(options:{owner:string}):Promise<{files:number;bytes:number;reviews:number;errors:number;planErrors:number;mediaKeys:string[]}>;
  migrateLegacy(): Promise<{complete:boolean;storage?:Record<string,string>}>;
  read(options: {owner: string; key: string}): Promise<{record?: NativeRecord}>;
  list(options: {owner: string; prefix: string}): Promise<{records: NativeRecord[]}>;
  write(options: {owner: string; records: {key: string; value: unknown; savedAt?: number}[]}): Promise<void>;
  remove(options: {owner: string; key: string}): Promise<void>;
  secretGet(options: {key: string}): Promise<{value?: string}>;
  secretSet(options: {key: string; value: string | null}): Promise<void>;
}>("NativeStore");

export async function encodeNativeValue(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer());
    let binary = "";
    for (let i=0; i<bytes.length; i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    return {__huellaBlob: true, type: value.type, data: btoa(binary)};
  }
  return value;
}
export function decodeNativeRecord<T>(record?: NativeRecord): {owner:string;key:string;value:T;savedAt:number} | undefined {
  if (!record) return;
  const v = record.value as {__huellaBlob?: boolean; type?: string; data?: string} | null;
  if (v?.__huellaBlob && typeof v.data === "string") {
    const bytes = Uint8Array.from(atob(v.data), c => c.charCodeAt(0));
    return {...record, value: new Blob([bytes], {type:v.type}) as T};
  }
  return record as {owner:string;key:string;value:T;savedAt:number};
}
