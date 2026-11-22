// Synthetic account; all network requests fail throughout both launches.
(async()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const call=(method,args)=>window.Capacitor.nativePromise('NativeStore',method,args);
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(fn,label){for(let i=0;i<300;i++){if(await fn())return;await pause(100);}throw Error('Timed out: '+label);}
 const checks=[],audio=[];const NativeAudio=window.Audio;
 window.Audio=function(...args){const e=new NativeAudio(...args);e.addEventListener('ended',()=>{if(e.duration>1)audio.push({duration:e.duration,local:e.src.startsWith('blob:')});});return e;};
 const go=path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));};
 try{
  await until(()=>document.body?.innerText.includes('Offline fixture only'),'offline Home');
  const restarting=!!(await call('read',{owner,key:'qa:daily-first'})).record;
  const start=performance.now();
  go('/study/session?filter=daily&limit=120&orientation=auto&autoFlip=0&autoAdvance=0');
  await until(()=>document.querySelector('.flashcard-inner'),'daily120 card');
  const openingMs=Math.round(performance.now()-start);
  const data=(await call('read',{owner,key:'study:daily'})).record.value;
  if(data.cards.length!==120||new Set(data.cards.map(c=>c.id)).size!==120)throw Error('Daily set size/uniqueness changed');
  if(data.daily.mix.retention!==50||data.daily.mix.practice!==70)throw Error('Daily learning history/mix changed');
  checks.push('Daily120 opens offline with120unique cards,70practice and50retention');
  if(restarting){
   const checkpoint=(await call('read',{owner,key:'checkpoint:study:daily'})).record.value;
   const reviews=(await call('list',{owner,prefix:'review:'})).records;
   if(checkpoint.currentIndex!==1||reviews.length!==1)throw Error('Restart lost or duplicated progress');
   if(!document.body.innerText.includes('2 / 120'))throw Error('Restart displayed incorrect position');
   checks.push('Full app restart offline restores card2/120 and the one pending rating');
   await call('write',{owner,records:[{key:'qa:daily-restart',value:{passed:true,checks,openingMs}}]});return;
  }
  await until(()=>audio.length>=1,'Spanish audio from downloaded file');
  document.querySelector('.flashcard-inner').click();
  await until(()=>audio.length>=2,'English audio from downloaded file');
  if(audio.some(a=>!a.local))throw Error('Audio was not local');
  checks.push('Spanish and English recordings both completed from saved bytes offline');
  const secure=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Secure');if(!secure)throw Error('Rating control missing');secure.click();
  await until(async()=>{const r=(await call('read',{owner,key:'checkpoint:study:daily'})).record;return r?.value.currentIndex===1;},'durable review checkpoint');
  if((await call('list',{owner,prefix:'review:'})).records.length!==1)throw Error('Offline rating not queued exactly once');
  checks.push('Offline rating saved with its session position before advancing');
  await call('write',{owner,records:[{key:'qa:daily-first',value:{passed:true,checks,audio,openingMs}}]});
 }catch(error){await call('write',{owner,records:[{key:'qa:daily-error',value:{passed:false,checks,error:String(error),text:document.body?.innerText.slice(0,1200)}}]});}
})();
