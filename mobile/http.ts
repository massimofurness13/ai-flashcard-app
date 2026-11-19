import {selectLocalStudy} from "@/lib/local-library";
import {readDeviceIdentity} from "@/lib/device-identity";
import {Capacitor,CapacitorHttp} from "@capacitor/core";
import {supportsLocalWrite,saveLocalWrite,cachedApi,projectPending,flushMutations,pendingMutations} from "./offline-api";
export const API_ORIGIN=process.env.NEXT_PUBLIC_APP_URL || "https://flashmind-35q4.onrender.com";
const originalFetch=globalThis.fetch.bind(globalThis);
export async function nativeFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 if(!Capacitor.isNativePlatform())return originalFetch(input,init);
 const request=new Request(input,init);
 const url=new URL(request.url);
 const supabase=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
 if(url.protocol!=="https:" || ![new URL(API_ORIGIN).host,supabase.host].includes(url.host)) throw Error("Unsupported service address");
 if(request.signal.aborted)throw new DOMException("Cancelled","AbortError");
 const headers=Object.fromEntries(request.headers.entries());
 let data:string|undefined;
 if(!["GET","HEAD"].includes(request.method)){
  const bytes=new Uint8Array(await request.arrayBuffer());let binary="";
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  data=btoa(binary);
 }
 const result=await CapacitorHttp.request({url:url.href,method:request.method,headers,data,dataType:"file",responseType:"arraybuffer",connectTimeout:15000,readTimeout:30000,disableRedirects:true});
 if(request.signal.aborted)throw new DOMException("Cancelled","AbortError");
 const responseHeaders=new Headers(result.headers);
 const body=responseHeaders.get("content-type")?.includes("application/json")?JSON.stringify(result.data):Uint8Array.from(atob(result.data||""),c=>c.charCodeAt(0));
 return new Response([204,205,304].includes(result.status)?null:body,{status:result.status,headers:responseHeaders});
}
export function installApiTransport(token:()=>Promise<{accessToken:string;userId:string}|null>){
 async function remote(path:string,options?:RequestInit){
  const headers=new Headers(options?.headers);
  const expected=readDeviceIdentity(localStorage)?.id;
  const session=await token();
  if(!session||!expected||session.userId!==expected||readDeviceIdentity(localStorage)?.id!==expected)return Response.json({error:"Sign in to sync your account. Your saved data is still available."},{status:401});
  headers.set("Authorization",`Bearer ${session.accessToken}`);
  return nativeFetch(API_ORIGIN+path,{...options,headers});
 }
 const sync=()=>{if(navigator.onLine)void flushMutations(body=>remote("/api/offline/mutations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}));};
 window.addEventListener("huella:data-changed",sync);window.addEventListener("online",sync);window.addEventListener("huella:edits",sync);
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")sync();});
 setInterval(sync,30000);
 globalThis.fetch=async(input,init)=>{
  const raw=input instanceof Request?input.url:String(input);
  const url=new URL(raw,location.origin);
  if(url.origin===new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin && url.pathname.startsWith("/storage/v1/object/public/"))return nativeFetch(input,init);
  if(url.origin!==location.origin || !url.pathname.startsWith("/api/"))return originalFetch(input,init);
  const method=(init?.method||(input instanceof Request?input.method:"GET")).toUpperCase();
  const path=url.pathname+url.search;
  if(supportsLocalWrite(url.pathname,method)){
   const body=init?.body??(input instanceof Request?await input.text():"{}");
   if(typeof body!=="string")return Response.json({error:"Unsupported edit format"},{status:400});
   return saveLocalWrite(url.pathname,method,JSON.parse(body));
  }
  if(method==="GET"&&url.pathname==="/api/review"&&url.searchParams.get("filter")==="mastery"){
   const owner=readDeviceIdentity(localStorage)?.id;
   if(owner){const local=await selectLocalStudy(owner,url.searchParams,new Date(),{all:true});if(local){
    const offset=Math.max(0,Number(url.searchParams.get("offset"))||0),limit=Math.max(1,Math.min(500,Number(url.searchParams.get("limit"))||100));
    return Response.json({...local,cards:local.cards.slice(offset,offset+limit),total:local.cards.length,totalDue:local.cards.length,nextOffset:offset+limit<local.cards.length?offset+limit:null});
   }}
  }
  if(method==="GET"&&init?.cache!=="no-store"){
   const saved=await cachedApi(path);if(saved!==undefined)return Response.json(saved);
  }
  const options=input instanceof Request?{method:input.method,body:["GET","HEAD"].includes(input.method)?undefined:await input.text(),signal:input.signal,...init}:{...init};
  if(method!=="GET" && (url.pathname.startsWith("/api/images/") || ["/api/review","/api/offline/plans"].includes(url.pathname))){
   await flushMutations(body=>remote("/api/offline/mutations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}));
   const owner=readDeviceIdentity(localStorage)?.id;
   if(owner&&(await pendingMutations(owner)).some(p=>url.pathname.startsWith("/api/images/") || !["card:delete","deck:delete"].includes(p.operation.kind)))return Response.json({error:"Your changes are saved on this iPhone. Connect and finish syncing them before this operation can sync."},{status:503});
  }
  const response=await remote(path,options);
  if(method==="GET"&&response.ok&&response.headers.get("content-type")?.includes("application/json"))return Response.json(await projectPending(path,await response.json()),{status:response.status});
  return response;
 };
}
