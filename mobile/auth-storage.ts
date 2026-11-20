import {NativeStore} from "@/lib/native-device";
import {DEVICE_SIGN_OUT_KEY,readDeviceIdentity} from "@/lib/device-identity";

export function createNativeAuthStorage(saved:()=>Storage|null=()=>{
 try{return globalThis.localStorage??null;}catch{return null;}
}){
 let recovered=false;
 return {
  async getItem(key:string):Promise<string|null>{
   const result=await NativeStore.secretGet({key});
   if(typeof result?.value==="string")return result.value;
   // Optional verifier/user entries are normally absent. Never treat that as a crash.
   // Only repair the primary session, once per launch, for the saved account.
   const storage=saved(),owner=readDeviceIdentity(storage)?.id;
   if(!recovered&&key==="sb-fghxwycixcawwtctknmp-auth-token"&&owner&&!storage?.getItem(DEVICE_SIGN_OUT_KEY)){
    recovered=true;
    // The old cookie may no longer exist. A timeout/failure is not proof of logout.
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{
     await Promise.race([NativeStore.recoverLegacySession({owner,signedOut:false}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Couldn’t reconnect yet. Your saved data is available.")),5000);})]);
    }finally{clearTimeout(timer);}
    return (await NativeStore.secretGet({key}))?.value??null;
   }
   return null;
  },
  async setItem(key:string,value:string){await NativeStore.secretSet({key,value});},
  async removeItem(key:string){
   // Do not resurrect a removed/invalid session during this client lifetime.
   if(key==="sb-fghxwycixcawwtctknmp-auth-token")recovered=true;
   await NativeStore.secretSet({key,value:null});
  },
 };
}
