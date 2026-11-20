// Isolated simulator account only: verify migration opens before slow media copies.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const output=process.argv[2]||'/tmp/huella-startup-fixture.json';
execFileSync(process.execPath,[new URL('./make-fixture.mjs',import.meta.url).pathname,output,'--migration']);
const fixture=JSON.parse(readFileSync(output,'utf8'));
fixture.migrationSeed+=`const originalBytes=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=async function(){await new Promise(r=>setTimeout(r,8000));return originalBytes.call(this)};`;
fixture.script=`Object.defineProperty(navigator,'onLine',{get:()=>false});
(async()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const call=(method,args)=>window.Capacitor.nativePromise('NativeStore',method,args);
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 const start=performance.now();
 async function until(fn,label){for(let i=0;i<400;i++){if(await fn())return;await pause(100);}throw Error(label);}
 try{
  await until(()=>document.body?.innerText.includes('Offline fixture only'),'Home never opened');
  const openMs=Math.round(performance.now()-start);
  const previous=(await call('read',{owner,key:'qa:startup'})).record;
  const keys=['media:fixture-audio','media:fixture-image'];
  const early=(await call('mediaStatus',{owner,keys})).keys;
  if(!previous&&early.length)throw Error('Startup waited for media');
  for(const key of ['query:/api/library','query:/api/decks/fixture-deck/view','library:manifest'])if(!(await call('read',{owner,key})).record)throw Error('Essential record missing: '+key);
  if(!localStorage.getItem('huella:device-identity:v1'))throw Error('Identity not restored');
  document.querySelector('.mobile-tab-bar a[href="/study"]').click();await until(()=>location.pathname==='/study','Study navigation failed');
  document.querySelector('.mobile-tab-bar a[href="/"]').click();await until(()=>location.pathname==='/'&&document.body.innerText.includes('Offline fixture only'),'Home navigation failed');
  await call('write',{owner,records:[{key:previous?'qa:startup-restart':'qa:startup',value:{passed:true,openMs,mediaAtOpen:early.length}}]});
  await until(async()=>(await call('mediaStatus',{owner,keys})).keys.length===2,'Media did not finish in background');
  await call('write',{owner,records:[{key:'qa:startup-media',value:{passed:true}}]});
 }catch(error){await call('write',{owner,records:[{key:'qa:startup-failure',value:{error:String(error),body:document.body?.innerText}}]});}
})();`;
writeFileSync(output,JSON.stringify(fixture));
