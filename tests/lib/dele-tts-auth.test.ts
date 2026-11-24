import {describe,it,expect} from 'vitest';
import {createHmac} from 'node:crypto';
import {validDeleSpeechProof} from '../../src/lib/dele-tts-auth';
describe('DELE voice-service proof',()=>{it('binds the exact body, timestamp and purpose without user/session impersonation',()=>{
 const secret='fixture-server-secret',body='{"text":"Hola","voice":"guide"}',now=1800000000000,stamp=String(now);
 const proof=createHmac('sha256',secret).update('dele-natural-audio-v1\n'+stamp+'\n'+body).digest('hex');
 expect(validDeleSpeechProof(body,stamp,proof,secret,now)).toBe(true);
 for(const [b,t,p,s,n]of [[body+' ',stamp,proof,secret,now],[body,stamp,proof,secret,now+61000],[body,stamp,proof,'other',now],[body,stamp,'invalid',secret,now],[body,null,proof,secret,now],[body,stamp,proof,undefined,now]] as const)expect(validDeleSpeechProof(b,t,p,s,n)).toBe(false);
})});
