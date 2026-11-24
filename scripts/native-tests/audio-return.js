// DEBUG isolated fixture only. Driver backgrounds this app using iOS Settings.
(async()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const call=(method,args)=>window.Capacitor.nativePromise('NativeStore',method,args);
 const report={passed:false,phase:'starting',starts:[],signals:[],ends:[],activity:[],network:[],checks:[]};
 const save=async phase=>{report.phase=phase;await call('write',{owner,records:[{key:'qa:audio-return',value:report}]});};
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(fn,label,limit=300){for(let i=0;i<limit;i++){if(fn())return;await delay(100);}throw Error(label);}
 const originalFetch=window.fetch;
 window.fetch=(input,init)=>{if(String(input).startsWith('blob:'))return originalFetch(input,init);report.network.push(String(input));return Promise.reject(new TypeError('Offline fixture'));};
 const RealContext=window.AudioContext;let ctx;
 window.AudioContext=class extends RealContext{
  constructor(...args){super(...args);ctx=this;}
  createBufferSource(){
   const source=super.createBufferSource(),originalStart=source.start.bind(source),analyser=this.createAnalyser(),mute=this.createGain();
   mute.gain.value=0;source.connect(analyser);analyser.connect(mute);mute.connect(this.destination);
   source.start=(...args)=>{const id=report.starts.length;report.starts.push({id,time:performance.now(),offset:args[1]||0});const values=new Float32Array(analyser.fftSize);let ticks=0;const timer=setInterval(()=>{analyser.getFloatTimeDomainData(values);const peak=Math.max(...values.map(Math.abs));if(peak>.005){report.signals.push({id,peak,time:performance.now(),clock:this.currentTime});clearInterval(timer);}else if(++ticks>200)clearInterval(timer);},20);source.addEventListener('ended',()=>{report.ends.push(id);clearInterval(timer);},{once:true});return originalStart(...args);};return source;
  }
 };
 await window.Capacitor.Plugins.App.addListener('appStateChange',({isActive})=>{report.activity.push({active:isActive,time:Date.now()});});
 try{
  await until(()=>document.body?.innerText.includes('Offline fixture only'),'Home');
  const daily=[...document.querySelectorAll('button')].find(b=>b.innerText.includes('my daily'));daily.click();
  await until(()=>document.querySelector('.flashcard-inner'),'Study');
  await until(()=>report.signals.length>=1,'First Spanish output signal');
  await until(()=>report.ends.includes(0),'First Spanish recording completed');
  let starts=report.starts.length,signals=report.signals.length;
  await save('background-heard');
  await until(()=>report.activity.some(a=>!a.active),'No native background event',900);
  await until(()=>report.activity.at(-1)?.active,'No native foreground event',900);
  await delay(700);
  if(report.starts.length!==starts)throw Error('Already-heard side replayed on return');
  report.checks.push('Returning to a fully heard side stays quiet');
  async function flip(label){
   const before=report.signals.length,at=performance.now();document.querySelector('.flashcard-inner').click();
   await until(()=>report.signals.length>before,label);
   const ms=report.signals.at(-1).time-at;report.checks.push(label+': '+Math.round(ms)+'ms to nonzero output');
   if(ms>500)throw Error(label+' exceeded 500ms: '+ms);
  }
  await flip('English flip after offline return');
  // Force a closed context as well as a native background interruption.
  await ctx.close();const events=report.activity.length;
  await save('background-closed');
  await until(()=>report.activity.slice(events).some(a=>!a.active),'Second background event',900);
  await until(()=>report.activity.length>events&&report.activity.at(-1)?.active,'Second foreground event',900);
  await delay(200);
  await flip('Spanish flip after closed output and second return');
  await flip('English again after repeated switches');
  // Advancing is another fresh utterance even when the next card has same text.
  signals=report.signals.length;
  const secure=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Secure');
  if(!secure)throw Error('Secure rating missing');secure.click();
  await until(()=>report.signals.length>signals,'Next card speech');
  report.checks.push('Next card starts saved speech after offline return');
  // Explicit pause must survive leaving/returning, without auto-rating.
  history.pushState({},'', '/study/session?deckIds=fixture-deck&limit=1&filter=random&autoFlip=3&autoAdvance=0&orientation=front');window.dispatchEvent(new PopStateEvent('popstate'));
  await until(()=>document.querySelector('[aria-label="Pause"]'),'Timed pause control');document.querySelector('[aria-label="Pause"]').click();await delay(200);
  starts=report.starts.length;const pauseEvents=report.activity.length;await save('background-paused');
  await until(()=>report.activity.slice(pauseEvents).some(a=>!a.active),'Paused background event',900);
  await until(()=>report.activity.length>pauseEvents&&report.activity.at(-1)?.active,'Paused foreground event',900);await delay(1200);
  if(report.starts.length!==starts||!document.querySelector('[aria-label="Resume"]'))throw Error('Explicit pause was lost');
  report.checks.push('Explicit pause survives app switch without playback or advancement');
  if(report.network.length)throw Error('Unexpected network dependency');
  report.passed=true;await save('complete');
 }catch(error){report.error=String(error);await save('failed');}
})();
