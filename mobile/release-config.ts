/** Native OAuth and session storage are pinned to this production project. */
export const NATIVE_SUPABASE_URL = "https://fghxwycixcawwtctknmp.supabase.co";
export const NATIVE_APP_URL = "https://flashmind-35q4.onrender.com";
export function validateNativeReleaseEnv(env: Record<string,string|undefined>, now=Date.now()) {
 if(env.NEXT_PUBLIC_SUPABASE_URL!==NATIVE_SUPABASE_URL || env.NEXT_PUBLIC_APP_URL!==NATIVE_APP_URL)
  throw Error("Native release blocked: configure the production Supabase and app URLs in .env.native.local.");
 let payload: {role?:string;ref?:string;exp?:number};
 try {payload=JSON.parse(Buffer.from((env.NEXT_PUBLIC_SUPABASE_ANON_KEY??'').split('.')[1],"base64url").toString());}
 catch {throw Error("Native release blocked: the production public anon key is missing or invalid.");}
 if(payload.role!=="anon" || payload.ref!=="fghxwycixcawwtctknmp" || !payload.exp || payload.exp*1000<=now)
  throw Error("Native release blocked: public anon key must match the production project and be unexpired. Never bundle a service-role key.");
}
