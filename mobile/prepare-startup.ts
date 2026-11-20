import {NativeStore} from "@/lib/native-device";

// A native bridge/storage failure must never strand the learner on a splash screen.
export async function prepareStartup(storage:Storage,timeoutMs=45000):Promise<void>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 const work=(async()=>{
  const result=await NativeStore.migrateLegacy();
  if(!result.complete)throw new Error("Upgrade incomplete");
  const previous=result.storage??(await NativeStore.read({owner:"__device__",key:"legacy-storage"})).record?.value as Record<string,string>|undefined;
  if(previous)for(const [key,value] of Object.entries(previous))if(storage.getItem(key)===null)storage.setItem(key,value);
 })();
 try{await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Opening timed out")),timeoutMs);})]);}
 finally{clearTimeout(timer);}
}
