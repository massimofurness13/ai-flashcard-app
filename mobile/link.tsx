import type {AnchorHTMLAttributes,MouseEvent} from "react";
import {navigate} from "./navigation";
type Props=Omit<AnchorHTMLAttributes<HTMLAnchorElement>,"href"> & {href:string|{pathname?:string;query?:Record<string,string>};prefetch?:boolean;replace?:boolean;scroll?:boolean};
export default function Link({href,prefetch,replace,scroll,onClick,...props}:Props){
 void prefetch; void scroll;
 const target=typeof href==="string"?href:(href.pathname||"/")+(href.query?"?"+new URLSearchParams(href.query):"");
 function click(e:MouseEvent<HTMLAnchorElement>){onClick?.(e);if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||props.target||props.download)return;
 if(target.startsWith("/")&&!target.startsWith("//")){e.preventDefault();navigate(target,replace);}}
 return <a {...props} href={target} onClick={click}/>;
}
