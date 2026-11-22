// DEBUG synthetic account: fetch only fixture artwork; never contact the service.
(async()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const native=window.Capacitor.nativePromise.bind(window.Capacitor);
 window.Capacitor.nativePromise=(plugin,method,args)=>{
  if(plugin!=='CapacitorHttp')return native(plugin,method,args);
  if(window.__qaOnline&&args.url===window.__qaImageUrl){window.__qaFetches.push(args.url);return Promise.resolve({status:200,headers:{'content-type':'image/png'},data:window.__qaImageBytes,url:args.url});}
  return Promise.reject(Error('Network disabled by isolated simulator test'));
 };
 const call=(method,args)=>window.Capacitor.nativePromise('NativeStore',method,args);
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(fn,label){for(let i=0;i<300;i++){if(await fn())return;await pause(100);}throw Error('Timed out: '+label);}
 const checks=[],metrics=[];
 function layout(side){
  const buttons=[...document.querySelectorAll('button')].filter(b=>['Secure','Kind of',"Don't know"].includes(b.textContent.trim()));
  const viewport=visualViewport.height;
  const font=parseFloat(getComputedStyle(document.querySelector('.flashcard-text')).fontSize);
  const overflow=document.documentElement.scrollHeight-innerHeight;
  metrics.push({side,viewport,font,overflow,bottom:Math.max(0,...buttons.map(b=>b.getBoundingClientRect().bottom))});
  if(overflow>1||font<24||(side==='back'&&buttons.length!==3)||buttons.some(b=>b.getBoundingClientRect().bottom>viewport))throw Error('Study layout does not fit: '+JSON.stringify(metrics));
 }
 try{
  await until(()=>document.body?.innerText.includes('Offline fixture only'),'Home');
  const restarting=!!(await call('read',{owner,key:'qa:artwork-first'})).record;
  history.pushState({},'','/study/session?filter=daily&limit=120&orientation=front&autoFlip=0&autoAdvance=0');window.dispatchEvent(new PopStateEvent('popstate'));
  await until(()=>document.querySelector('.flashcard-inner'),'study card');await pause(500);
  layout('front');
  if(!restarting){
   window.__qaOnline=true;window.dispatchEvent(new Event('online'));
   await until(async()=>!!(await call('read',{owner,key:'media:'+window.__qaImageUrl})).record,'artwork persisted while studying');
   checks.push('Artwork saved automatically while Study stayed open');
  }
  window.__qaOnline=false;window.dispatchEvent(new Event('offline'));
  await until(()=>[...document.querySelectorAll('.flashcard-illustration img')].some(i=>i.src.startsWith('blob:')&&i.complete&&i.naturalWidth>0),'visible image from saved bytes');
  document.querySelector('.flashcard-inner').click();await pause(500);layout('back');
  checks.push('Both sides fit without page scroll; larger text and all three ratings visible');
  if(restarting&&window.__qaFetches.length)throw Error('Restart needed network for saved image');
  checks.push(restarting?'Artwork survives full offline restart without a fetch':'Current image updates when its background download completes');
  await call('write',{owner,records:[{key:restarting?'qa:artwork-restart':'qa:artwork-first',value:{passed:true,checks,metrics,fetches:window.__qaFetches}}]});
 }catch(error){await call('write',{owner,records:[{key:'qa:artwork-error',value:{passed:false,checks,metrics,error:String(error),text:document.body?.innerText.slice(0,1000)}}]});}
})();
