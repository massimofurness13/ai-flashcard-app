// Isolated DEBUG account only. Opens no Google session and records no real study.
(async()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(fn,label){for(let i=0;i<300;i++){if(await fn())return;await pause(100);}throw Error('Timed out: '+label);}
 const checks=[];let original;
 try{
  await until(()=>document.body?.innerText.includes('Offline fixture only'),'saved fixture home');
  original=window.Capacitor.nativePromise.bind(window.Capacitor);
  let authorize;
  window.Capacitor.nativePromise=function(plugin,method,options,...rest){
   if(plugin==='NativeAuth'&&method==='authenticate'){
    authorize=new URL(options.url);
    return Promise.reject(new Error('QA stopped before interactive Google sign-in'));
   }
   return original(plugin,method,options,...rest);
  };
  history.pushState({},'','/auth/login');window.dispatchEvent(new PopStateEvent('popstate'));
  await until(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Continue with Google')),'Google button');
  [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Continue with Google')).click();
  await until(()=>authorize,'native authentication handoff');
  if(authorize.origin!=='https://fghxwycixcawwtctknmp.supabase.co'||authorize.pathname!=='/auth/v1/authorize')throw Error('Incorrect native authorize address');
  if(authorize.searchParams.get('redirect_to')!=='https://flashmind-35q4.onrender.com/auth/callback')throw Error('Incorrect callback');
  if(!authorize.searchParams.get('code_challenge'))throw Error('Missing PKCE challenge');
  checks.push('Actual bundled Google button supplies production authorize URL, callback and PKCE challenge');
  const r=await fetch('https://fghxwycixcawwtctknmp.supabase.co/auth/v1/settings',{headers:{apikey:window.__huellaPublicAnon}});
  const data=await r.json();if(r.status!==200||data.external?.google!==true)throw Error('Live production auth settings unavailable');
  checks.push('Real iOS native HTTP reached production authentication; Google is enabled');
  window.Capacitor.nativePromise=original;
  await original('NativeStore','write',{owner,records:[{key:'qa:production',value:{passed:true,checks}}]});
 }catch(error){if(original){window.Capacitor.nativePromise=original;await original('NativeStore','write',{owner,records:[{key:'qa:production',value:{passed:false,error:String(error),checks}}]});}}
})();
