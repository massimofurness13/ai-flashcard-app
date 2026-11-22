import {beforeEach,it,expect,vi} from 'vitest';
import sharp from 'sharp';
const m=vi.hoisted(()=>({subscribe:vi.fn(),upload:vi.fn(),consume:vi.fn(),refund:vi.fn(),vision:vi.fn()}));
vi.mock('@fal-ai/client',()=>({fal:{config:vi.fn(),subscribe:m.subscribe}}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({storage:{from:()=>({upload:m.upload,getPublicUrl:()=>({data:{publicUrl:'https://storage.test/valid.png'}})})}})}));
vi.mock('@anthropic-ai/sdk',()=>({default:class{messages={create:m.vision};}}));
vi.mock('@/lib/auth',()=>({requireAuth:async()=>({userId:'owner'})}));
vi.mock('@/lib/image-quota',()=>({consumeImageCredit:m.consume,refundImageCredit:m.refund}));
vi.mock('@/lib/validations',async original=>({...await original<object>(),rateLimit:()=>true}));
import {generateAndUploadFromPrompt,generateAndUploadImage} from '@/lib/image-gen';
import {POST} from '@/app/api/images/generate-ai/route';
let blank:Buffer,valid:Buffer;
beforeEach(async()=>{
 vi.resetAllMocks();vi.stubEnv('FAL_KEY','fixture');vi.stubEnv('ANTHROPIC_API_KEY','');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://storage.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','fixture');
 blank=await sharp({create:{width:256,height:256,channels:3,background:'black'}}).png().toBuffer();
 valid=await sharp({create:{width:256,height:256,channels:3,background:'white'}}).composite([{input:Buffer.from('<svg width="256" height="256"><circle cx="128" cy="128" r="60" fill="blue"/></svg>')}]).png().toBuffer();
 m.subscribe.mockResolvedValue({data:{images:[{url:'https://provider.test/image'}]}});m.upload.mockResolvedValue({error:null});m.consume.mockResolvedValue({ok:true,source:'credits',amountUsed:5});m.refund.mockResolvedValue(undefined);
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(Uint8Array.from(blank))));
});
it.each(['prompt','card'])('retries one black output and uploads only validated replacement for %s generation',async type=>{
 vi.mocked(fetch).mockResolvedValueOnce(new Response(Uint8Array.from(blank))).mockResolvedValueOnce(new Response(Uint8Array.from(valid)));
 const url=type==='prompt'?await generateAndUploadFromPrompt('owner','room'):await generateAndUploadImage('owner','habitación','room');
 expect(url).toContain('valid.png');expect(m.subscribe).toHaveBeenCalledTimes(2);expect(m.upload).toHaveBeenCalledTimes(1);expect(m.upload.mock.calls[0][1].equals(valid)).toBe(true);
});
it.each(['credits','monthly'])('refunds %s balance once when both attempts are blank, never returns or stores a URL',async source=>{
 m.consume.mockResolvedValue({ok:true,source,amountUsed:5});
 const r=await POST(new Request('https://app.test/api/images/generate-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({front:'habitación',tier:'premium'})}));
 expect(r.status).toBe(500);expect((await r.json()).imageUrl).toBeUndefined();expect(m.subscribe).toHaveBeenCalledTimes(2);expect(m.upload).not.toHaveBeenCalled();expect(m.refund).toHaveBeenCalledExactlyOnceWith('owner',source,5,expect.any(Object));
});
it('never replaces a valid original with a blank semantic retry',async()=>{
 vi.stubEnv('ANTHROPIC_API_KEY','fixture');m.vision.mockResolvedValueOnce({content:[{type:'text',text:'a room'}]}).mockResolvedValueOnce({content:[{type:'text',text:'BAD: wrong object'}]});
 vi.mocked(fetch).mockResolvedValueOnce(new Response(Uint8Array.from(valid))).mockResolvedValueOnce(new Response(Uint8Array.from(blank)));
 await generateAndUploadImage('owner','habitación','room');expect(m.subscribe).toHaveBeenCalledTimes(2);expect(m.upload.mock.calls[0][1].equals(valid)).toBe(true);
});
it('shares a two-call ceiling between blank retries and semantic review',async()=>{
 vi.stubEnv('ANTHROPIC_API_KEY','fixture');m.vision.mockResolvedValueOnce({content:[{type:'text',text:'a room'}]}).mockResolvedValueOnce({content:[{type:'text',text:'BAD: wrong object'}]});
 vi.mocked(fetch).mockResolvedValueOnce(new Response(Uint8Array.from(blank))).mockResolvedValueOnce(new Response(Uint8Array.from(valid)));
 await generateAndUploadImage('owner','habitación','room');expect(m.subscribe).toHaveBeenCalledTimes(2);
});
