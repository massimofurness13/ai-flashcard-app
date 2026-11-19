import { listRecords, deleteRecord, writeRecord } from "./device-db";
import { deviceOwner } from "./device-media";
export async function flushLocalPlans(owner: string) {
  for (const item of await listRecords(owner,"plan:")) {
    if (await deviceOwner() !== owner || navigator.onLine === false) return;
    if ((item.value as {error?:string}).error) continue;
    const response = await fetch("/api/offline/plans",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(item.value),redirect:"error",signal:AbortSignal.timeout(15000)});
    const data = await response.json();
    if (response.ok && data.recorded===true) await deleteRecord(owner,item.key);
    else if ([400,409].includes(response.status)) await writeRecord(owner,item.key,{...item.value as object,error:data.error || "Offline plan needs attention"});
    else return;
  }
}
