import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {DEVICE_IDENTITY_KEY,DEVICE_SIGN_OUT_KEY} from '@/lib/device-identity';
import {deviceQueryError,QueryRefreshError} from '@/lib/device-query-error';
const bridge=vi.hoisted(()=>({secretGet:vi.fn(),secretSet:vi.fn(),recoverLegacySession:vi.fn()}));
vi.mock('@/lib/native-device',()=>({NativeStore:bridge}));
import {createNativeAuthStorage} from '../../mobile/auth-storage';
const key='sb-fghxwycixcawwtctknmp-auth-token';
const owner='11111111-1111-4111-8111-111111111111';
function saved(signedOut=false){const values=new Map([[DEVICE_IDENTITY_KEY,JSON.stringify({version:1,user:{id:owner,user_metadata:{}}})]]);if(signedOut)values.set(DEVICE_SIGN_OUT_KEY,JSON.stringify({at:Date.now()}));return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>{values.delete(k);},clear:()=>values.clear(),key:(i:number)=>[...values.keys()][i]??null,get length(){return values.size;}} satisfies Storage;}
beforeEach(()=>vi.resetAllMocks());
describe('native auth storage',()=>{
 it.each([undefined,{}, {value:undefined}])('handles an empty optional bridge reply: %j',async result=>{
  bridge.secretGet.mockResolvedValue(result);const storage=createNativeAuthStorage(()=>saved());
  expect(await storage.getItem(key+'-code-verifier')).toBeNull();expect(bridge.recoverLegacySession).not.toHaveBeenCalled();
 });
 it('repairs a missing primary credential once, for the selected account only',async()=>{
  bridge.secretGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({value:'recovered'}).mockResolvedValue(undefined);
  bridge.recoverLegacySession.mockResolvedValue({});const storage=createNativeAuthStorage(()=>saved());
  expect(await storage.getItem(key)).toBe('recovered');await storage.getItem(key);
  expect(bridge.recoverLegacySession).toHaveBeenCalledExactlyOnceWith({owner,signedOut:false});
 });
 it('never recovers credentials after an explicit logout or after removal',async()=>{
  bridge.secretGet.mockResolvedValue({});const signedOut=createNativeAuthStorage(()=>saved(true));await signedOut.getItem(key);
  const removed=createNativeAuthStorage(()=>saved());await removed.removeItem(key);await removed.getItem(key);
  expect(bridge.recoverLegacySession).not.toHaveBeenCalled();
 });
 it('does not turn a Keychain access failure into a missing session',async()=>{
  bridge.secretGet.mockRejectedValue(new Error('Secure storage is unavailable'));
  await expect(createNativeAuthStorage(()=>saved()).getItem(key)).rejects.toThrow('Secure storage');expect(bridge.recoverLegacySession).not.toHaveBeenCalled();
 });
 it('restores a real Supabase client from its stored session without another sign-in',async()=>{
  const session={access_token:'fixture-access-only',refresh_token:'fixture-refresh-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:owner,aud:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01'}};
  bridge.secretGet.mockImplementation(async({key:requested})=>requested===key?{value:JSON.stringify(session)}:undefined);
  const fetch=vi.fn();const client=createClient('https://fghxwycixcawwtctknmp.supabase.co','fixture-anon',{auth:{storage:createNativeAuthStorage(()=>saved()),storageKey:key,autoRefreshToken:false,detectSessionInUrl:false,persistSession:true},global:{fetch}});
  const result=await client.auth.getSession();expect(result.error).toBeNull();expect(result.data.session?.user.id).toBe(owner);expect(fetch).not.toHaveBeenCalled();expect(bridge.recoverLegacySession).not.toHaveBeenCalled();
 });
 it('keeps implementation errors out of the statistics UI',()=>{
  expect(deviceQueryError(new TypeError("undefined is not an object: secretGet.value"))).toBe('Couldn’t refresh yet. Showing saved data.');
  expect(deviceQueryError(new QueryRefreshError('Showing saved data.'))).toBe('Showing saved data.');
 });
});
