// Isolated simulator only: no learner session or production requests.
(async()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const call=(method,args)=>window.Capacitor.nativePromise('NativeStore',method,args);
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(fn,label){for(let n=0;n<240;n++){if(await fn())return;await pause(100);}throw Error('Timed out: '+label);}
 const go=path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));};
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 const checks=[];
 try{
  await until(()=>document.body?.innerText.includes('Offline fixture only'),'home');
  const raw=(await call('read',{owner,key:'query:/api/stats?period=30'})).record.value;
  let ready=false;
  window.fetch=async(input,options)=>{
   const url=new URL(String(input),location.origin);
   if(url.pathname==='/api/stats'){
    if(url.searchParams.get('period')==='7'&&!ready)return new Promise((_,reject)=>{
      const fail=()=>reject(new DOMException('Cancelled','AbortError'));
      if(options?.signal?.aborted)fail();else options?.signal?.addEventListener('abort',fail,{once:true});
    });
    return Response.json({...raw,dailyCounts:raw.dailyCounts.slice(-Number(url.searchParams.get('period')))});
   }
   throw Error('Only synthetic statistics are available');
  };
  go('/stats');
  await until(()=>button('Try again'),'initial timeout ends Opening');
  checks.push('Empty-cache refresh times out with a retry instead of infinite Opening');
  button('30 days').click();
  await until(()=>document.body.innerText.includes('Recent activity · 30 days'),'30-day chart');
  ready=false;button('7 days').click();await pause(300);
  if(!document.body.innerText.includes('Statistics')||!button('30 days'))throw Error('Statistics disappeared during switch');
  checks.push('Seven-day switch keeps statistics and controls visible during refresh');
  await until(()=>button('Try again'),'failed seven-day refresh');
  if(!document.body.innerText.includes('Recent activity'))throw Error('Chart disappeared after failure');
  checks.push('Seven-day failure preserves the chart and exposes retry');
  ready=true;button('Try again').click();await until(()=>!button('Try again')&&document.body.innerText.includes('Recent activity · 7 days'),'successful retry');
  checks.push('Retry refreshes the seven-day view successfully');
  await call('write',{owner,records:[{key:'qa:stats',value:{passed:true,checks}}]});
 }catch(error){await call('write',{owner,records:[{key:'qa:stats',value:{passed:false,checks,error:String(error),text:document.body?.innerText.slice(0,1500)}}]});}
})();
