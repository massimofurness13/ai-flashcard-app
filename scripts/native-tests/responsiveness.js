(async()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const call=(method,args)=>window.Capacitor.nativePromise('NativeStore',method,args);
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(fn,label){for(let i=0;i<200;i++){if(await fn())return;await pause(50);}throw Error('Timed out: '+label);}
 const checks=[];const timings={};
 let heartbeat=0;const timer=setInterval(()=>heartbeat++,20);
 try {
  await until(()=>document.body?.innerText.includes('Offline fixture only'),'home');
  // Hold the acknowledgement forever. Dismissing the modal must still work.
  const fetchBefore=window.fetch;
  window.fetch=(input,init)=>String(input).includes('/api/user/goal-celebration')?new Promise(()=>{}):fetchBefore(input,init);
  await until(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Got it'),'celebration');
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Got it').click();
  await until(()=>!document.body.innerText.includes('You hit your daily goal!'),'dismiss with pending upload');
  checks.push('Goal overlay dismisses while its acknowledgement never returns');
  for(const text of ['Choose packs & study settings','Today’s progress awaiting sync','1 SECTION','1,466 cards','Using saved library'])if(document.body.innerText.includes(text))throw Error('Unwanted Home text: '+text);
  const archive=document.querySelector('a[href="/archive"]'), pack=document.querySelector('a[href="/decks/fixture-deck"]');
  if(!(pack.compareDocumentPosition(archive)&Node.DOCUMENT_POSITION_FOLLOWING))throw Error('Archive link is not below packs');
  checks.push('Compact Home labels and archive position verified');
  await call('write',{owner,records:[{key:'qa:responsive-home-ready',value:true}]});
  await pause(2000);
  const keys=Array.from({length:200},(_,i)=>`media:fixture-bulk-${i}`);
  const began=performance.now(),beatBefore=heartbeat;
  const background=(async()=>{for(let i=0;i<15;i++){
   const result=await call('mediaStatus',{owner,keys});
   if(result.keys.length!==200 || JSON.stringify(result).length>10000)throw Error('Media checks transferred bytes or lost files');
  }})();
  document.querySelector('.mobile-tab-bar a[href="/study"]').click();
  await until(()=>location.pathname==='/study','study navigation');
  document.querySelector('.mobile-tab-bar a[href="/"]').click();
  await until(()=>location.pathname==='/'&&document.body.innerText.includes('Do my daily 120'),'home navigation');
  const start=performance.now();
  [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Do my daily 120')).click();
  await until(()=>document.querySelector('.flashcard-inner'),'daily cards');
  timings.dailyOpenIncludingCountdownMs=Math.round(performance.now()-start);
  await background;
  timings.metadataAndNavigationMs=Math.round(performance.now()-began);
  if(heartbeat-beatBefore<3)throw Error('UI heartbeat stalled');
  checks.push('Navigation and daily120 work during repeated native metadata checks');
  const data=(await call('read',{owner,key:'study:daily'})).record.value;
  if(data.cards.length!==120 || new Set(data.cards.map(c=>c.id)).size!==120)throw Error('Daily set count/uniqueness');
  if(data.daily.mix.retention!==50)throw Error('Retention allocation changed');
  checks.push('1466-card library produces120unique cards with50retention');
  await call('write',{owner,records:[{key:'qa:responsive',value:{passed:true,checks,timings,heartbeats:heartbeat}}]});
  history.pushState({},'', '/');window.dispatchEvent(new PopStateEvent('popstate'));
  await pause(1000);[...document.querySelectorAll('button')].find(b=>b.textContent==='Got it')?.click();
 }catch(error){await call('write',{owner,records:[{key:'qa:responsive',value:{passed:false,checks,timings,error:String(error),body:document.body?.innerText}}]});}
 finally{clearInterval(timer);}
})();
