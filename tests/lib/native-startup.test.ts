import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {IDBFactory} from "fake-indexeddb";
const native=vi.hoisted(()=>({migrateLegacy:vi.fn(),read:vi.fn()}));
vi.mock("@/lib/native-device",()=>({NativeStore:native}));
import {prepareStartup} from "../../mobile/prepare-startup";
function storage(initial:Record<string,string>={}){
 const values=new Map(Object.entries(initial));
 return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},key:(i:number)=>[...values.keys()][i]??null,get length(){return values.size;},removeItem:(key:string)=>{values.delete(key);},clear:()=>values.clear()} satisfies Storage;
}
beforeEach(()=>vi.resetAllMocks());afterEach(()=>vi.useRealTimers());
describe("native startup",()=>{
 it("restores previous settings without replacing newer local choices",async()=>{
  native.migrateLegacy.mockResolvedValue({complete:true,storage:{theme:"dark","huella-settings":"old","huella:device-identity:v1":"saved identity"}});
  const local=storage({"huella-settings":"new"});await prepareStartup(local);
  expect(local.getItem("huella-settings")).toBe("new");expect(local.getItem("huella:device-identity:v1")).toBe("saved identity");expect(local.getItem("theme")).toBe("dark");
 });
 it("bounds a bridge which never replies, and permits a later retry",async()=>{
  vi.useFakeTimers();native.migrateLegacy.mockReturnValueOnce(new Promise(()=>{}));
  const result=expect(prepareStartup(storage(),100)).rejects.toThrow("timed out");await vi.advanceTimersByTimeAsync(100);await result;
  native.migrateLegacy.mockResolvedValueOnce({complete:true});native.read.mockResolvedValue({});await expect(prepareStartup(storage())).resolves.toBeUndefined();
 });
 it("keeps local data on an incomplete upgrade and does not open the app",async()=>{
  native.migrateLegacy.mockResolvedValue({complete:false});const local=storage({draft:"unsynced"});
  await expect(prepareStartup(local)).rejects.toThrow("incomplete");expect(local.getItem("draft")).toBe("unsynced");expect(native.read).not.toHaveBeenCalled();
 });
 it("opens after essential records and before a deliberately blocked media transfer",async()=>{
  const indexedDB=new IDBFactory();
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const q=indexedDB.open("huella-device-v1",1);q.onupgradeneeded=()=>q.result.createObjectStore("records",{keyPath:["owner","key"]});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  const records=[{owner:"a",key:"media:audio",value:new Blob(["audio"])},{owner:"a",key:"review:pending",value:{quality:4}},{owner:"a",key:"study:daily",value:{completed:51}},{owner:"b",key:"edit:pending",value:{front:"corrected"}}];
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction("records","readwrite");for(const record of records)tx.objectStore("records").put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  const messages:Array<{kind:string;record?:typeof records[number]}>=[];let releaseMedia!:()=>void;const mediaWait=new Promise<void>(r=>{releaseMedia=r;});let ready!:()=>void;const readyWait=new Promise<void>(r=>{ready=r;});
  const swift=readFileSync("ios/App/App/LegacyMigration.swift","utf8");const script=swift.split('private static let exportScript = #"""')[1].split('"""#')[0];
  const completion=runInNewContext(script,{location:{origin:"https://flashmind-35q4.onrender.com",pathname:"/native-upgrade.html"},indexedDB,Blob,Uint8Array,btoa,localStorage:storage({theme:"dark"}),window:{webkit:{messageHandlers:{huellaMigration:{postMessage:async(message:typeof messages[number])=>{messages.push(message);if(message.kind==="ready")ready();if(message.record?.key.startsWith("media:"))await mediaWait;return true;}}}}}});
  await readyWait;
  expect(messages.filter(m=>m.kind==="record").map(m=>m.record?.key)).toEqual(["review:pending","study:daily","edit:pending"]);
  expect(messages.some(m=>m.kind==="done")).toBe(false);
  releaseMedia();await completion;
  expect(messages.at(-1)?.kind).toBe("done");
  const count=await new Promise<number>(resolve=>{const q=db.transaction("records").objectStore("records").count();q.onsuccess=()=>resolve(q.result);});expect(count).toBe(4);db.close();
 });
});
