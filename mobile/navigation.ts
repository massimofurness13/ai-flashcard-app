import {useSyncExternalStore,useMemo} from "react";
const subscribe=(fn:()=>void)=>{window.addEventListener("popstate",fn);return()=>window.removeEventListener("popstate",fn);};
const snapshot=()=>window.location.pathname+window.location.search;
export const useLocation=()=>useSyncExternalStore(subscribe,snapshot,snapshot);
export const usePathname=()=>useLocation().split("?")[0];
export function useSearchParams(){const path=useLocation();return useMemo(()=>new URLSearchParams(path.split("?")[1]||""),[path]);}
export function navigate(path:string,replace=false){
 const url=new URL(path,location.href);
 if(url.origin!==location.origin) {window.open(url.href,"_blank","noopener");return;}
 if(!path.startsWith("/") || path.startsWith("//")) throw Error("Invalid app route");
 history[replace?"replaceState":"pushState"]({},"",url.pathname+url.search);window.dispatchEvent(new PopStateEvent("popstate"));window.scrollTo(0,0);
}
const router={push:(p:string)=>navigate(p),replace:(p:string)=>navigate(p,true),back:()=>history.back(),forward:()=>history.forward(),refresh:()=>window.dispatchEvent(new Event("huella:data-changed")),prefetch:()=>Promise.resolve()};
export const useRouter=()=>router;
