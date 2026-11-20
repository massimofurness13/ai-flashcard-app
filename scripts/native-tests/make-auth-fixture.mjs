// Synthetic cookies and credentials in the isolated app.huella.authqa simulator only.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const output=process.argv[2]||'/tmp/huella-auth-fixture.json';
execFileSync(process.execPath,[new URL('./make-fixture.mjs',import.meta.url).pathname,output,'--migration']);
const f=JSON.parse(readFileSync(output,'utf8'));
const key='sb-fghxwycixcawwtctknmp-auth-token';
const session={access_token:'fixture-access-not-real',refresh_token:'fixture-refresh-not-real',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:f.owner,aud:'authenticated',app_metadata:{},user_metadata:{full_name:'Offline fixture'},created_at:'2026-01-01'}};
f.migrationSeed+=`document.cookie=${JSON.stringify(key+'=base64-'+Buffer.from(JSON.stringify(session)).toString('base64url')+'; Path=/; Domain=.flashmind-35q4.onrender.com; Secure; SameSite=Lax')};`;
f.script=`Object.defineProperty(navigator,'onLine',{get:()=>false});
(async()=>{
 const owner='11111111-1111-4111-8111-111111111111',key='sb-fghxwycixcawwtctknmp-auth-token';
 const call=(m,a)=>window.Capacitor.nativePromise('NativeStore',m,a);
 const pause=ms=>new Promise(r=>setTimeout(r,ms));const checks=[];
 try{
  for(let i=0;i<300&&!document.body?.innerText.includes('Offline fixture only');i++)await pause(100);
  if(!document.body?.innerText.includes('Offline fixture only'))throw Error('Home not available');
  const original=(await call('secretGet',{key}))?.value;
  if(!original||JSON.parse(original).user.id!==owner)throw Error('Legacy credential migration failed');
  checks.push('Existing legacy cookie session preserved in Keychain');
  const empty=await call('secretGet',{key:key+'-nonexistent-fixture'});
  if(!empty||empty.value!==undefined)throw Error('Missing-key bridge result is not an object');
  checks.push('Missing optional key returns empty object');
  await call('secretSet',{key,value:null});
  await call('recoverLegacySession',{owner:'22222222-2222-4222-8222-222222222222',signedOut:false});
  if((await call('secretGet',{key}))?.value)throw Error('Recovered a different account');
  await call('recoverLegacySession',{owner,signedOut:true});
  if((await call('secretGet',{key}))?.value)throw Error('Recovered despite sign-out');
  checks.push('Wrong-account recovery and signed-out recovery rejected');
  await call('recoverLegacySession',{owner,signedOut:false});
  const repaired=JSON.parse((await call('secretGet',{key}))?.value||'null');
  if(repaired?.user?.id!==owner||repaired?.refresh_token!=='fixture-refresh-not-real')throw Error('Repair could not restore matching cookie');
  checks.push('Matching legacy session repaired without a login');
  const newer=JSON.stringify({...JSON.parse(original),refresh_token:'newer-fixture-refresh'});
  await call('secretSet',{key,value:newer});await call('recoverLegacySession',{owner,signedOut:false});
  if((await call('secretGet',{key}))?.value!==newer)throw Error('Recovery replaced newer session');
  checks.push('Newer Keychain session preserved');
  await call('secretSet',{key,value:null});
  await Promise.all([call('recoverLegacySession',{owner,signedOut:false}),call('secretSet',{key,value:null})]);
  if((await call('secretGet',{key}))?.value)throw Error('Late recovery undid session removal');
  checks.push('Session removal wins over in-flight recovery');
  await call('secretSet',{key,value:original});
  await call('write',{owner,records:[{key:'qa:auth',value:{passed:true,checks}}]});
 }catch(error){await call('write',{owner,records:[{key:'qa:auth',value:{passed:false,checks,error:String(error)}}]});}
})();`;
writeFileSync(output,JSON.stringify(f));
