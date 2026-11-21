import { defineConfig, loadEnv } from "vite";
import { resolve,dirname } from "node:path";
import {createRequire} from "node:module";
import {parse} from "dotenv";
import {validateNativeReleaseEnv} from "./release-config";
import {createHash} from "node:crypto";
import {existsSync,readFileSync,readdirSync,writeFileSync} from "node:fs";
const root = resolve(import.meta.dirname,"..");
export default defineConfig(({mode})=>{
 const nativePath=resolve(root,".env.native.local");
 const env={...loadEnv(mode,root,""),...(existsSync(nativePath)?parse(readFileSync(nativePath)): {})};
 for(const key of ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","NEXT_PUBLIC_APP_URL"])if(process.env[key]!==undefined)env[key]=process.env[key]!;
 validateNativeReleaseEnv(env);
 const allowed=["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","NEXT_PUBLIC_APP_URL","NEXT_PUBLIC_BUILD_SHA"];
 const definitions=Object.fromEntries(allowed.map(key=>[`process.env.${key}`,JSON.stringify(env[key] || (key==="NEXT_PUBLIC_APP_URL"?"https://flashmind-35q4.onrender.com":""))]));
 if(!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw Error("Native build requires the public Supabase URL and anon key.");
 return {
  root:resolve(root,"mobile"),base:"/",publicDir:false,
  plugins:[{name:"native-production-manifest",writeBundle(options){
   const directory=options.dir!;
   const assets=readdirSync(resolve(directory,"assets")).filter(file=>file.endsWith(".js")&&!file.startsWith("pdf.worker.")).map(file=>({file:`assets/${file}`,sha256:createHash("sha256").update(readFileSync(resolve(directory,"assets",file))).digest("hex")}));
   writeFileSync(resolve(directory,"huella-release.json"),JSON.stringify({supabaseUrl:env.NEXT_PUBLIC_SUPABASE_URL,appUrl:env.NEXT_PUBLIC_APP_URL,assets}));
  }},{name:"bundled-pdf-worker",generateBundle(){
   const require=createRequire(import.meta.url),packagePath=require.resolve("pdfjs-dist/package.json");
   const {version}=require(packagePath);
   this.emitFile({type:"asset",fileName:`pdf.worker.${version}.min.mjs`,source:readFileSync(resolve(dirname(packagePath),"build/pdf.worker.min.mjs"))});
  }}],
  define:{...definitions,"process.env.NODE_ENV":JSON.stringify(mode==="production"?"production":"development")},
  resolve:{alias:[
   {find:"@/lib/supabase/client",replacement:resolve(root,"mobile/auth.ts")},
   {find:"@/components/layout/media-service-worker",replacement:resolve(root,"mobile/bundled-shell.ts")},
   {find:"next/navigation",replacement:resolve(root,"mobile/navigation.ts")},
   {find:"next/link",replacement:resolve(root,"mobile/link.tsx")},
   {find:"@",replacement:resolve(root,"src")},
  ]},
  build:{outDir:"dist",emptyOutDir:true,target:"safari15",sourcemap:false},
 };
});
