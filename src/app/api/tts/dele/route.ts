import {validDeleSpeechProof} from '@/lib/dele-tts-auth';
import {getVoiceEntry} from '@/lib/voice-catalog';
import {getOrCreateAudioUrl} from '@/lib/tts-server';
import {rateLimit} from '@/lib/validations';
const voices={guide:'es-US',reply:'es-US-m',english:'en-US-m'} as const;
const pending=new Map<string,Promise<string>>();
export async function POST(req:Request){
 if(Number(req.headers.get('content-length')||0)>12000)return Response.json({error:'Too large'},{status:413});
 const raw=await req.text();
 if(raw.length>4000)return Response.json({error:'Too large'},{status:413});
 if(!validDeleSpeechProof(raw,req.headers.get('x-dele-time'),req.headers.get('x-dele-proof'),process.env.SUPABASE_SERVICE_ROLE_KEY))return Response.json({error:'Unauthorized'},{status:401});
 if(!rateLimit('dele-natural-audio',240,60000))return Response.json({error:'Try later'},{status:429});
 let b:any;try{b=JSON.parse(raw)}catch{return Response.json({error:'Invalid request'},{status:400})}
 if(typeof b.text!=='string'||!b.text.trim()||b.text.length>500||!Object.hasOwn(voices,b.voice))return Response.json({error:'Invalid request'},{status:400});
 const voice=voices[b.voice as keyof typeof voices],key=voice+'|'+b.text;
 try{
  let job=pending.get(key);if(!job){job=getOrCreateAudioUrl(b.text,getVoiceEntry(voice)!,{strictVoice:true});pending.set(key,job)}
  const audioUrl=await job;
  return Response.json({audioUrl},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Audio preparation unavailable'},{status:503})}
 finally{pending.delete(key)}
}
