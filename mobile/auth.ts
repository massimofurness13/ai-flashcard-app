import {createClient as supabase, type SupabaseClient} from "@supabase/supabase-js";
import {NativeStore,isNativeDevice} from "@/lib/native-device";
import {nativeFetch} from "./http";
let instance:SupabaseClient|undefined;
export function createClient(){
 if(!instance)instance=supabase(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
  auth:{flowType:"pkce",detectSessionInUrl:false,persistSession:true,autoRefreshToken:true,
   storage:isNativeDevice()?{getItem:async key=>(await NativeStore.secretGet({key})).value??null,setItem:async(key,value)=>{await NativeStore.secretSet({key,value});},removeItem:async key=>{await NativeStore.secretSet({key,value:null});}}:undefined},
  global:{fetch:nativeFetch},
 });
 return instance;
}
