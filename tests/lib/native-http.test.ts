import {beforeEach,describe,expect,it,vi} from 'vitest';
const bridge=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true},CapacitorHttp:bridge,registerPlugin:()=>({})}));
import {nativeFetch,withAbort} from '../../mobile/http';
beforeEach(()=>{vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://storage.invalid');bridge.request.mockReset();});
describe('native request deadlines',()=>{
 it('lets a card request time out while the native bridge is still pending',async()=>{
  bridge.request.mockReturnValue(new Promise(()=>{}));const controller=new AbortController();
  const request=nativeFetch('https://storage.invalid/storage/v1/object/public/a',{signal:controller.signal});
  const rejected=expect(request).rejects.toMatchObject({name:'AbortError'});
  await vi.waitFor(()=>expect(bridge.request).toHaveBeenCalledOnce());controller.abort();await rejected;
 });
 it.each([
  ['/api/images/generate-ai',180000], ['/api/images/feedback',180000], ['/api/review',15000],
 ])('uses the iOS request timeout for %s',async(path,timeout)=>{
  bridge.request.mockResolvedValue({status:200,headers:{'content-type':'application/json'},data:{}});
  await nativeFetch('https://storage.invalid'+path,{method:'POST',body:'{}'});
  expect(bridge.request).toHaveBeenCalledWith(expect.objectContaining({connectTimeout:timeout}));
 });
 it('also stops waiting for a stalled token refresh',async()=>{
  const controller=new AbortController();const result=withAbort(new Promise(()=>{}),controller.signal);
  const rejected=expect(result).rejects.toMatchObject({name:'AbortError'});controller.abort();await rejected;
 });
 it('retains a successful native JSON response',async()=>{
  bridge.request.mockResolvedValue({status:200,headers:{'content-type':'application/json'},data:{cards:[]}});
  expect(await (await nativeFetch('https://storage.invalid/test')).json()).toEqual({cards:[]});
 });
});
