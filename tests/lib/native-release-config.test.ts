import {describe,it,expect} from 'vitest';
import {validateNativeReleaseEnv,NATIVE_APP_URL,NATIVE_SUPABASE_URL} from '../../mobile/release-config';
const key=(role='anon',ref='fghxwycixcawwtctknmp',exp=2000000000)=>'e30.'+Buffer.from(JSON.stringify({role,ref,exp})).toString('base64url')+'.signature';
const valid=()=>({NEXT_PUBLIC_SUPABASE_URL:NATIVE_SUPABASE_URL,NEXT_PUBLIC_APP_URL:NATIVE_APP_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:key()});
describe('native release configuration',()=>{
 it('accepts the production public configuration',()=>expect(()=>validateNativeReleaseEnv(valid())).not.toThrow());
 it('rejects the placeholder previously shipped in builds 4–9',()=>expect(()=>validateNativeReleaseEnv({...valid(),NEXT_PUBLIC_SUPABASE_URL:'https://placeholder.supabase.co'})).toThrow('blocked'));
 it('rejects a wrong callback origin',()=>expect(()=>validateNativeReleaseEnv({...valid(),NEXT_PUBLIC_APP_URL:'http://localhost:3000'})).toThrow('blocked'));
 it('rejects absent and dummy public keys',()=>{for(const value of ['',undefined,'fixture-anon'])expect(()=>validateNativeReleaseEnv({...valid(),NEXT_PUBLIC_SUPABASE_ANON_KEY:value})).toThrow('blocked');});
 it('never accepts a service-role key',()=>expect(()=>validateNativeReleaseEnv({...valid(),NEXT_PUBLIC_SUPABASE_ANON_KEY:key('service_role')})).toThrow('blocked'));
 it('rejects another project or an expired key',()=>{for(const value of [key('anon','other'),key('anon',undefined,1)])expect(()=>validateNativeReleaseEnv({...valid(),NEXT_PUBLIC_SUPABASE_ANON_KEY:value})).toThrow('blocked');});
});
