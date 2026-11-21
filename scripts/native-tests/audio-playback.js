// Runs only in the isolated DEBUG simulator fixture; never a learner account.
(async () => {
 const owner='11111111-1111-4111-8111-111111111111';
 const call=(method,args)=>window.Capacitor.nativePromise('NativeStore',method,args);
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(fn,label){for(let i=0;i<300;i++){if(await fn())return;await pause(100);}throw Error('Timed out: '+label);}
 const go=path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));};
 const checks=[], recordings=[];
 const play=HTMLMediaElement.prototype.play;
 let injectFailure=false;
 HTMLMediaElement.prototype.play=function(){
  if(injectFailure){injectFailure=false;return Promise.reject(new DOMException('Fixture simulates iOS blocking playback','NotAllowedError'));}
  return play.call(this);
 };
 const NativeAudio=window.Audio;
 window.Audio=function(...args){
  const element=new NativeAudio(...args);
  element.addEventListener('ended',()=>{
   if(element.duration>1)recordings.push({duration:element.duration,source:element.src.startsWith('blob:')?'saved-blob':'remote'});
  });
  return element;
 };
 try {
  await until(()=>document.body?.innerText.includes('Offline fixture only'),'saved home');
  go('/study/session?deckIds=fixture-deck&limit=2&filter=random&autoFlip=1&autoAdvance=1&orientation=front');
  await until(()=>document.querySelector('.flashcard-inner'),'study');
  await until(()=>recordings.length===1,'first Spanish recording');
  checks.push('First Spanish recording completed from saved bytes offline');
  injectFailure=true;document.querySelector('.flashcard-inner').click();
  await until(()=>document.querySelector('[aria-label="Retry audio"]'),'failed playback retry control');
  await pause(1200);
  if(recordings.length!==1)throw Error('Failure incorrectly counted as playback');
  checks.push('Playback failure stayed on the current card and offered retry');
  document.querySelector('[aria-label="Retry audio"]').click();
  await until(()=>recordings.length===2,'first English retry');
  checks.push('Speaker retry completed English recording; auto-advance resumed only after speech');
  await until(()=>recordings.length===3,'second Spanish recording');
  document.querySelector('.flashcard-inner').click();
  await until(()=>recordings.length===4,'second English recording');
  if(recordings.some(r=>r.source!=='saved-blob'))throw Error('A clip required the network');
  checks.push('Second card played both languages, all four recordings completed offline');
  await call('write',{owner,records:[{key:'qa:audio',value:{passed:true,checks,recordings}}]});
 } catch(error){await call('write',{owner,records:[{key:'qa:audio',value:{passed:false,error:String(error),checks,recordings}}]});}
})();
