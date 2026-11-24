import {it,expect,vi,beforeEach} from 'vitest';
import {createHmac} from 'node:crypto';
vi.mock('@/lib/tts-server',()=>({getOrCreateAudioUrl:vi.fn(async()=> 'https://fixture/audio.mp3')}));
vi.mock('@/lib/validations',()=>({rateLimit:()=>true}));
import {POST} from '../../src/app/api/tts/dele/route';
import {getOrCreateAudioUrl} from '../../src/lib/tts-server';
beforeEach(()=>{process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-secret';vi.clearAllMocks()});
function signed(value:unknown){const body=JSON.stringify(value),stamp=String(Date.now()),proof=createHmac('sha256','fixture-secret').update('dele-natural-audio-v1\n'+stamp+'\n'+body).digest('hex');return new Request('https://fixture/api/tts/dele',{method:'POST',body,headers:{'X-Dele-Time':stamp,'X-Dele-Proof':proof}})}
it('rejects anonymous callers before generation',async()=>{expect((await POST(new Request('https://fixture',{method:'POST',body:'{}'}))).status).toBe(401);expect(getOrCreateAudioUrl).not.toHaveBeenCalled()});
it('rejects arbitrary providers and oversized text',async()=>{for(const b of [{text:'hola',voice:'robot'},{text:'x'.repeat(501),voice:'guide'}])expect((await POST(signed(b))).status).toBe(400);expect(getOrCreateAudioUrl).not.toHaveBeenCalled()});
it('uses the exact existing guide and reply voices, disallowing default-voice fallback',async()=>{for(const [voice,name]of [['guide','es-US-Chirp3-HD-Aoede'],['reply','es-US-Chirp3-HD-Charon'],['english','en-US-Chirp3-HD-Charon']]){expect((await POST(signed({text:'Hola',voice}))).status).toBe(200);expect(getOrCreateAudioUrl).toHaveBeenLastCalledWith('Hola',expect.objectContaining({google:expect.objectContaining({name})}),{strictVoice:true})}});
