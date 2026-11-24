// DEBUG simulator only: real MP3s supplied by a synthetic account fixture.
(async()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const call=(method,args)=>window.Capacitor.nativePromise('NativeStore',method,args);
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const report={starts:[],decodes:[],network:[],htmlLoads:0,ends:[],passed:false};
 const nativeFetch=window.fetch;
 // Local blob reads are allowed; every actual network request is rejected.
 window.fetch=(input,init)=>{if(String(input).startsWith('blob:'))return nativeFetch(input,init);report.network.push(String(input));return Promise.reject(new TypeError('Network disabled by test'));};
 const NativeContext=window.AudioContext;let ctx,lastFlip=0;
 window.AudioContext=class extends NativeContext {
  constructor(...args){super(...args);ctx=this;}
  async decodeAudioData(...args){const start=performance.now();const buffer=await super.decodeAudioData(...args);report.decodes.push({ms:performance.now()-start,duration:buffer.duration});return buffer;}
  createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.addEventListener("ended",()=>report.ends.push(performance.now()));source.start=(when,offset,...args)=>{report.starts.push({at:performance.now(),afterFlip:lastFlip?performance.now()-lastFlip:null,offset:offset||0,duration:source.buffer?.duration});return start(when,offset,...args);};return source;}
 };
 const oldLoad=HTMLMediaElement.prototype.load;HTMLMediaElement.prototype.load=function(){report.htmlLoads++;return oldLoad.call(this);};
 async function until(fn,label){for(let i=0;i<300;i++){if(fn())return;await delay(100);}throw Error(label);}
 try{
 await until(()=>document.body?.innerText.includes('Offline fixture only'),'Home unavailable');
 const daily=[...document.querySelectorAll('button')].find(b=>b.innerText.includes('my daily'));if(!daily)throw Error('No daily entry');daily.click();
 await until(()=>document.querySelector('.flashcard-inner'),'Study unavailable');
 await until(()=>report.starts.length>0,'First prepared recording did not start');
 await delay(3500);
 const loads=report.htmlLoads;
 for(let i=0;i<6;i++){const before=report.starts.length;lastFlip=performance.now();document.querySelector('.flashcard-inner').click();await until(()=>report.starts.length>before,'Flip audio failed');await delay(1200);}
 report.loadsDuringFlips=report.htmlLoads-loads;
 await ctx.suspend();lastFlip=performance.now();document.dispatchEvent(new Event('visibilitychange'));await delay(200);
 const before=report.starts.length;document.querySelector('.flashcard-inner').click();await until(()=>report.starts.length>before,'Resume failed');
 // Rapid flips must cancel older sources; the final recording must still run.
 for(let i=0;i<4;i++){document.querySelector('.flashcard-inner').click();await delay(80);}
 await delay(3500);
 // Timed mode: verify real end callbacks still release flip/advance timers.
 const timedStart=report.starts.length;
 history.pushState({},'', '/study/session?deckIds=fixture-deck&limit=3&filter=random&autoFlip=1&autoAdvance=1&orientation=front');window.dispatchEvent(new PopStateEvent('popstate'));
 await until(()=>report.starts.length>=timedStart+4,'Timed flip/advance did not continue after speech');
 report.timedStarts=report.starts.length-timedStart;
 report.passed=report.network.length===0&&report.loadsDuringFlips===0&&report.starts.length>=8;
 if(!report.passed)throw Error('Network access or HTML reload detected');
 }catch(e){report.error=String(e);}
 await call('write',{owner,records:[{key:'qa:prepared-audio',value:report}]});
})();
