import {createClient as supabase, type SupabaseClient} from "@supabase/supabase-js";
import {isNativeDevice} from "@/lib/native-device";
import {createNativeAuthStorage} from "./auth-storage";
import {nativeFetch} from "./http";
let instance:SupabaseClient|undefined;
export function createClient(){
 if(!instance)instance=supabase(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
  auth:{flowType:"pkce",detectSessionInUrl:false,persistSession:true,autoRefreshToken:true,
   storage:isNativeDevice()?createNativeAuthStorage():undefined},
  global:{fetch:nativeFetch},
 });
 return instance;
}
