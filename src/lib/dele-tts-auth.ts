import {createHmac,timingSafeEqual} from 'node:crypto';
// A body-bound, short-lived proof from the existing DELE/Huella server link.
// The Supabase key is never sent over this connection or exposed to clients.
export function validDeleSpeechProof(body:string,stamp:string|null,proof:string|null,secret:string|undefined,now=Date.now()){
 if(!secret||!stamp||!/^\d{13}$/.test(stamp)||Math.abs(now-Number(stamp))>60000||!proof||! /^[a-f0-9]{64}$/.test(proof))return false;
 const expected=createHmac('sha256',secret).update('dele-natural-audio-v1\n'+stamp+'\n'+body).digest();
 return timingSafeEqual(expected,Buffer.from(proof,'hex'));
}
