(async()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const call=(method,args)=>window.Capacitor.nativePromise('NativeStore',method,args);
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(fn,label){for(let n=0;n<400;n++){if(await fn())return;await pause(100);}throw Error('Timed out: '+label);}
 const go=path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));};
 const records=async prefix=>(await call('list',{owner,prefix})).records;
 const checks=[];
 try{
  await until(()=>document.body?.innerText.includes('Offline fixture only'),'offline home');checks.push('Bundled home opened without a network');
  const audioRecord=(await call('read',{owner,key:'media:fixture-audio'})).record;
  if(!audioRecord?.value?.data)throw Error('Saved audio bytes missing');
  const audio=new Audio(URL.createObjectURL(new Blob([Uint8Array.from(atob(audioRecord.value.data),c=>c.charCodeAt(0))],{type:'audio/wav'})));
  await audio.play();await until(()=>audio.ended,'local audio playback');URL.revokeObjectURL(audio.src);checks.push('Saved audio file played without a network');
  const imageRecord=(await call('read',{owner,key:'media:fixture-image'})).record;
  const img=new Image();img.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(imageRecord.value.data),c=>c.charCodeAt(0))],{type:'image/png'}));await img.decode();URL.revokeObjectURL(img.src);checks.push('Saved artwork decoded without a network');
  if((await records('qa:result')).length){
   const pending=await records('review:');if(pending.length!==1)throw Error('Review was lost or duplicated across restart');
   const edits=await records('mutation:');if(edits.length!==1)throw Error('Edit was lost or duplicated across restart');
   checks.push('Queued review and edit survived a full app restart');
   await call('write',{owner,records:[{key:'qa:restart',value:{checks,passed:true}}]});return;
  }
  go('/decks/fixture-deck/cards/fixture-card-1/edit');await until(()=>document.getElementById('front'),'offline editor');
  const field=document.getElementById('front');const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
  setter.call(field,'uno — edited offline');field.dispatchEvent(new Event('input',{bubbles:true}));await pause(100);
  document.querySelector('form').requestSubmit();
  await until(async()=>(await records('mutation:')).length===1,'durable edit');checks.push('Card edited offline and queued');
  await pause(500);
  go('/study/session?deckIds=fixture-deck&limit=3&filter=random&autoFlip=0&autoAdvance=0&orientation=front');
  await until(()=>document.querySelector('.flashcard-inner'),'offline study');
  document.querySelector('.flashcard-inner').click();
  await until(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Secure'),'ratings');
  [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Secure').click();
  await until(async()=>(await records('review:')).length===1,'durable review');
  checks.push('Study opened and rating saved with network disabled');
  const checkpoints=await records('checkpoint:');if(!checkpoints.length)throw Error('Session checkpoint missing');checks.push('Session cursor saved alongside review');
  go('/');await until(()=>document.body.innerText.includes('Offline fixture only'),'return home');checks.push('Navigated home locally');
  await call('write',{owner,records:[{key:'qa:result',value:{checks,passed:true}}]});
 }catch(error){console.error('NATIVE_OFFLINE_QA',String(error));await call('write',{owner,records:[{key:'qa:failure',value:{checks,error:String(error),body:document.body?.innerText}}]});}
})();
