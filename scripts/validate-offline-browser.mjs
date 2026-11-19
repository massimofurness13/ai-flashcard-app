/** Fixture-only production browser validation. No application imports or live accounts.
 * Usage: node scripts/validate-offline-browser.mjs /tmp/isolated-production-copy
 * Build that copy WITHOUT .env files using NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:43180,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key, DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:9/fixture.
 * Set BROWSER_ENGINE=webkit and use Playwright >=1.62 for persisted WebKit caches.
 * WebKit disconnects the fixture server (not a mocked browser offline flag).
 * PLAYWRIGHT_MODULE and CHROMIUM_PATH may override the locally discovered installations.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer, request } from 'node:http';
import { createServer as createTLSServer } from 'node:https';
import { createServer as createGateway, connect } from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
const require = createRequire(import.meta.url);
const build = resolve(process.argv[2] || '');
assert(process.argv[2] && build.startsWith('/tmp/'), 'Pass an isolated /tmp production copy; never use a live workspace');
await readFile(join(build, '.next/BUILD_ID'));
let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath) {
  try { modulePath = require.resolve('playwright-core'); } catch {
    for (const folder of await readdir(join(homedir(), '.npm/_npx'))) {
      const candidate = join(homedir(), '.npm/_npx', folder, 'node_modules/playwright-core');
      try { require.resolve(candidate); modulePath = candidate; break; } catch {}
    }
  }
}
const { chromium, webkit } = require(modulePath);
const safari = process.env.BROWSER_ENGINE === "webkit";
const artifacts = await mkdtemp(join(tmpdir(), 'huella-browser-proof-'));
const origin = 'http://127.0.0.1:43180';
const owner = '11111111-1111-4111-8111-111111111111';
const deck = {id:'fixture-deck',name:'Offline fixture only',emoji:'🧪',frontLanguageCode:'es-ES',backLanguageCode:'en-US'};
const cards = ['uno','dos','tres'].map((word, i) => ({id:`fixture-card-${i+1}`,front:word,back:['one','two','three'][i],imageUrl:'https://127.0.0.1:43180/storage/v1/object/public/fixtures/pixel.png',imageTier:null,hint:null,studyDirection:'front',deck}));
const day = new Date(Date.now()-6*60*60*1000).toISOString().slice(0,10);
const user = {id:owner,aud:'authenticated',role:'authenticated',email:'offline-fixture@example.invalid',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:'Offline fixture'},created_at:new Date().toISOString()};
const expires = Math.floor(Date.now()/1000)+86400;
const token = [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:owner,aud:'authenticated',role:'authenticated',exp:expires})).toString('base64url'),'fixture-signature'].join('.');
const session = {access_token:token,refresh_token:'fixture-refresh',expires_in:86400,expires_at:expires,token_type:'bearer',user};
const writes = [], requests = [], failures = [], checks = [], blockedExternal = [];
const accepted = new Map();
let offline = false, acknowledge = false, staleHome = false, failPreparation = false, context, page;
const daily = () => ({cards:cards.filter(c=>!accepted.has(c.id)),learningLanguage:'es',daily:{day,timingKey:`fixture:${day}`,completed:accepted.size,total:3,ratings:{1:[...accepted.values()].filter(r=>r.quality===1).length,2:[...accepted.values()].filter(r=>r.quality===2).length,4:[...accepted.values()].filter(r=>r.quality===4).length},mix:{practice:3,retention:0,new:0}}});
const json = (res, data, status=200) => {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const proxy = createServer(async (req,res)=> {
  if (offline) {req.socket.destroy();return;}
  const url = new URL(req.url,origin);
  requests.push({method:req.method,path:url.pathname,query:url.search});
  if (url.pathname.startsWith('/auth/v1/')) {
    if (url.pathname.endsWith('/user')) return json(res,user);
    if (url.pathname.endsWith('/token')) return json(res,session);
    if (url.pathname.endsWith('/logout')) return json(res,{});
    return json(res,{},404);
  }
  if (url.pathname.startsWith('/api/')) {
    let body='';for await(const piece of req) body+=piece;
    if(url.pathname==='/api/review') {
      if(req.method==='GET') return failPreparation ? json(res,{error:'Fixture unavailable'},503) : json(res,daily());
      const review=JSON.parse(body); assert(cards.some(c=>c.id===review.cardId),'Only fixture cards may be written');
      writes.push({method:req.method,...review,acknowledged:acknowledge});
      if(!acknowledge) return json(res,{recorded:false});
      if(req.method==='DELETE') accepted.delete(review.cardId);else accepted.set(review.cardId,review);
      return json(res,{recorded:true,eventId:review.eventId});
    }
    if(url.pathname==='/api/library')return json(res,{dailyStudy:{day,timeZone:'UTC',total:3,completed:accepted.size},folders:[],unfolderedDecks:[{...deck,_count:{cards:3},grade:'New',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastStudiedAt:null}],totalCards:3,userName:'Offline fixture',reviewDay:staleHome?'2000-01-01':day,reviewTimeZone:'UTC',cardsReviewedToday:staleHome?120:accepted.size,dailyGoal:3,streak:0,goalHitCelebrationShown:true,onboardingCompleted:true});
    if(url.pathname==='/api/decks/fixture-deck/view')return json(res,{deck:{...deck,cards:cards.map((c,i)=>({...c,tags:null,createdAt:'2026-01-01',nextReviewAt:'2026-01-01',easeFactor:2.5,interval:0,repetitions:0,recallStates:[],reviews:[]})),_count:{cards:3},folder:null,description:null},overallGrade:'New',avgMastery:0,gradeDistribution:{A:0,B:0,C:0,D:0,F:0,New:3},isPro:true,canViewAiImages:true,learningLanguage:'es'});
    if(url.pathname==='/api/stats')return json(res,{cardsReviewedToday:accepted.size,dailyGoal:3,totalReviews:accepted.size,dailyCounts:[],heatmapData:[],calendarMonth:[]});
    if(url.pathname==='/api/subscription/status')return json(res,{isPro:true});
    if(url.pathname==='/api/offline/plans')return json(res,{recorded:true});
    if(url.pathname==='/api/study-config')return json(res,{decks:[{...deck,_count:{cards:3}}]});
    if(url.pathname==='/api/images/quota')return json(res,{isPro:true,canViewAiImages:true,credits:1000,remaining:1000,totalRemaining:1000});
    if(url.pathname==='/api/user/tags')return json(res,{tags:[]});
    if(url.pathname==='/api/tts')return json(res,{audioUrl:'https://127.0.0.1:43180/storage/v1/object/public/fixtures/silence.wav'});
    if(url.pathname==='/api/study-results')return json(res,{day,total:3,completed:accepted.size,promoted:0,returnedToLearning:0,retentionReviewed:0,retentionSecure:0});
    return json(res,{},404);
  }
  if(url.pathname==='/monitoring'){res.writeHead(204);res.end();return;}
  const upstream=request({hostname:'127.0.0.1',port:43181,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:43181'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});req.pipe(upstream);
});
// WebKit performs TLS negotiation before Playwright's route fulfillment.
// Serve genuine fixture TLS for saved media on the same host/port; never
// weaken certificate handling for a real service or user browser.
const fixtureKey=join(artifacts,'fixture.key'), fixtureCert=join(artifacts,'fixture.crt');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',fixtureKey,'-out',fixtureCert,'-days','1','-subj','/CN=127.0.0.1'],{stdio:'ignore'});
const tlsProxy=createTLSServer({key:await readFile(fixtureKey),cert:await readFile(fixtureCert)},(req,res)=>{
  if(offline){req.socket.destroy();return;}
  const pathname=new URL(req.url,origin).pathname;
  if(!pathname.startsWith('/storage/v1/object/public/fixtures/')){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':pathname.endsWith('.png')?'image/png':'audio/wav','Access-Control-Allow-Origin':'*'});
  res.end(pathname.endsWith('.png')?png:wav);
});
const sockets=new Set();
const gateway=createGateway(socket=>{
  sockets.add(socket);socket.once('close',()=>sockets.delete(socket));
  socket.once('data',data=>{
    socket.pause();
    const upstream=connect({host:'127.0.0.1',port:data[0]===22?43182:43183},()=>{
      upstream.write(data);socket.pipe(upstream);upstream.pipe(socket);socket.resume();
    });
    upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());
    socket.on('close',()=>upstream.destroy());
  });
});
await new Promise(r=>proxy.listen(43183,'127.0.0.1',r));
await new Promise(r=>tlsProxy.listen(43182,'127.0.0.1',r));
await new Promise(r=>gateway.listen(43180,'127.0.0.1',r));
const serverLog = createWriteStream(join(artifacts,'server.log'));
const server=spawn(process.execPath,[join(build,'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p','43181'],{cwd:build,env:{HOME:homedir(),PATH:process.env.PATH,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:origin,NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-anon-key',DATABASE_URL:'postgresql://fixture:fixture@127.0.0.1:9/fixture'},stdio:['ignore','pipe','pipe']});
server.stdout.pipe(serverLog);server.stderr.pipe(serverLog);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const check=(name,details={})=>{checks.push({name,...details});console.log('PASS',name,JSON.stringify(details));};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOioAAAAASUVORK5CYII=','base64');
const wav=Buffer.alloc(44+1600);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(1600,40);
async function launch(isOffline=false){
  context=await (safari ? webkit : chromium).launchPersistentContext(join(artifacts,'profile'),{headless:true,...(safari ? {} : {executablePath:process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']}),ignoreHTTPSErrors:safari,offline:safari ? false : isOffline,viewport:{width:430,height:900},serviceWorkers:'allow'});
  // Fixture media/auth/API are local and synthetic; no real account or TTS service.
  // WebKit uses real local TLS: request routing interferes with its SW cache.
  if (!safari) await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.protocol==='data:'||url.protocol==='blob:')return route.continue();
    if(url.hostname!=='127.0.0.1'){blockedExternal.push(url.origin);return route.abort();}
    if(url.protocol==='https:'&&url.pathname.startsWith('/storage/')){
      if(offline)return route.abort();
      if(safari)return route.continue();
      return route.fulfill({status:200,contentType:url.pathname.endsWith('.png')?'image/png':'audio/wav',body:url.pathname.endsWith('.png')?png:wav,headers:{'Access-Control-Allow-Origin':'*'}});
    }
    return route.continue();
  });
  await context.addInitScript(()=>{
    window.__fixtureBlobs={};window.__fixtureAudio=[];
    const create=URL.createObjectURL.bind(URL);
    URL.createObjectURL=blob=>{const url=create(blob);window.__fixtureBlobs[url]={size:blob.size,type:blob.type};return url;};
    const AudioConstructor=window.Audio;
    window.Audio=new Proxy(AudioConstructor,{construct(target,args){
      const audio=Reflect.construct(target,args);
      for(const type of ['loadeddata','playing','ended'])audio.addEventListener(type,()=>window.__fixtureAudio.push({event:type,src:audio.currentSrc,readyState:audio.readyState,blob:window.__fixtureBlobs[audio.currentSrc]}));
      return audio;
    }});
  });
  page=context.pages()[0]||await context.newPage();
  page.on('pageerror',e=>{failures.push({type:'pageerror',message:e.message});console.error('BROWSER ERROR',e.message);});
  page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE',m.text());});
  page.on('requestfailed',r=>console.error('REQUEST FAILED',r.url(),r.failure()?.errorText));
  page.setDefaultTimeout(20000);
}
const records=()=>page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('huella-device-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  if(!db.objectStoreNames.contains('records')){db.close();return [];}
  return new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').getAll();r.onsuccess=()=>{db.close();resolve(r.result);};r.onerror=()=>reject(r.error);});
});
async function pollRecords(test,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){const data=await records();if(test(data))return data;await delay(150);}throw Error('IndexedDB condition timed out');}
async function rate(label,next){
  const card=page.locator('.study-flashcard');await card.waitFor();
  const button=page.getByRole('button',{name:label,exact:true});
  if(!(await button.isVisible()))await card.click();
  await button.click();
  if(next)await page.locator('.study-session').getByText(next,{exact:true}).waitFor();
}
const sessionUrl=origin+'/study/session?filter=daily&limit=120&orientation=front&autoFlip=0&autoAdvance=0';
try{
  for(let i=0;i<100;i++){try{const r=await fetch(origin+'/study');if(r.ok)break;}catch{}await delay(100);}
  await launch();
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:origin,sameSite:'Lax',expires}]);
  await page.goto(origin+'/study',{waitUntil:'domcontentloaded'});
  await page.getByText('Offline fixture only',{exact:true}).waitFor();
  check('fixture authenticated study configuration');
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.waitForFunction(async()=>{const c=await caches.open('huella-shell-index-v1');return !!await c.match(location.origin+'/__huella_shell__');},{},{timeout:60000});
  await pollRecords(r=>r.some(x=>x.key==='library:sync-status'&&x.value.phase==='ready'),60000);
  const cacheAudit=await page.evaluate(async()=>{const result={};for(const name of await caches.keys()){const c=await caches.open(name);result[name]=(await c.keys()).map(r=>new URL(r.url).pathname);}return result;});
  assert.equal(Object.values(cacheAudit).filter(paths=>paths.includes('/study/session')).length,1,'One complete public shell must be published');
  assert(!Object.values(cacheAudit).flat().some(p=>p.startsWith('/api/')||p.startsWith('/auth/')));
  check('real service worker published safe shell and static caches',{caches:Object.fromEntries(Object.entries(cacheAudit).map(([k,v])=>[k,v.length]))});
  const prepared=await pollRecords(r=>r.some(x=>x.key==='library:sync-status'&&x.value.phase==='ready'));
  assert.equal(prepared.find(x=>x.key==='study:daily').value.cards.length,3);
  assert.equal(prepared.filter(x=>x.key.startsWith('audio:v1:')).length,6);
  const pack=prepared.find(x=>x.key==='pack:fixture-deck');
  assert(pack && pack.value.urls.length===2,'Manifest must include audio and artwork');
  assert.equal(prepared.filter(x=>x.key.startsWith('media:')).length,2);
  check('automatic preparation reaches Ready with three cards, six audio mappings and complete media manifest',{cards:3,audioMappings:6,mediaFiles:2});
  await page.goto(sessionUrl,{waitUntil:'domcontentloaded'});
  await page.locator('.study-flashcard').waitFor();
  await page.screenshot({path:join(artifacts,'01-online.png')});
  check('fixture daily session opened online');
  await context.close();offline=true;
  await launch(true);
  const libraryCold=await page.goto(origin+'/decks/fixture-deck',{waitUntil:'domcontentloaded'});
  assert(libraryCold.fromServiceWorker());
  await page.getByRole('heading',{name:/Offline fixture only/}).waitFor();
  check('never-opened pack opens after offline process restart from full-library sync');
  await page.goto(origin+'/study/session?filter=random&deckIds=fixture-deck&limit=5&autoFlip=0&autoAdvance=0',{waitUntil:'domcontentloaded'});
  await page.locator('.study-flashcard').waitFor();
  const custom=await pollRecords(r=>r.some(x=>x.key.startsWith('study:')&&x.key.includes('random')&&x.value.cards.length===5));
  const selection=custom.find(x=>x.key.startsWith('study:')&&x.key.includes('random')).value.cards;
  assert.equal(new Set(selection.slice(0,3).map(c=>c.id)).size,3);
  check('unprepared custom study works offline with unique cards before repeats');
  const cold=await page.goto(sessionUrl,{waitUntil:'domcontentloaded'});
  assert(cold.fromServiceWorker(),'Cold document must come from the real SW');
  await page.locator('.study-flashcard').waitFor();
  assert.equal(await page.evaluate(()=>sessionStorage.length),0,'Cold launch cannot depend on sessionStorage');
  check('browser process restart offline cold launch',{fromServiceWorker:true});
  await page.waitForFunction(()=>[...document.querySelectorAll('.study-flashcard img')].some(img=>img.src.startsWith('blob:')&&img.complete&&img.naturalWidth>0));
  check('artwork decodes from saved device blob after offline process restart');
  await page.locator('.study-flashcard').click();
  await page.waitForFunction(()=>window.__fixtureAudio.some(a=>a.event==='loadeddata'&&a.src.startsWith('blob:')&&a.readyState>0&&a.blob?.size===1644));
  const audioEvidence=await page.evaluate(()=>window.__fixtureAudio.filter(a=>a.src.startsWith('blob:')&&a.blob?.size===1644));
  check('offline card flip loads saved audio blob',{events:audioEvidence.map(a=>({event:a.event,readyState:a.readyState,blob:a.blob}))});
  await rate('Secure','dos');
  await rate('Kind of','tres');
  let saved=await pollRecords(r=>r.filter(x=>x.key.startsWith('review:')).length===2&&r.some(x=>x.key==='checkpoint:study:daily'&&x.value.currentIndex===2));
  assert(saved.every(x=>x.owner===owner));
  const eventIds=saved.filter(x=>x.key.startsWith('review:')).map(x=>x.value.eventId);
  check('two ratings and matching checkpoint durable offline',{eventIds,checkpoint:saved.find(x=>x.key==='checkpoint:study:daily').value.currentIndex});
  await page.screenshot({path:join(artifacts,'02-offline-rated.png')});
  await context.close();await launch(true);
  const restored=await page.goto(sessionUrl,{waitUntil:'domcontentloaded'});assert(restored.fromServiceWorker());
  await page.locator('.study-session').getByText('tres',{exact:true}).waitFor();
  assert.equal((await records()).filter(x=>x.key.startsWith('review:')).length,2);
  check('second offline process restart restores card three and pending ratings');
  await rate('Secure');
  await page.getByRole('heading',{name:'Daily session complete'}).waitFor();
  await pollRecords(r=>r.some(x=>x.key==='checkpoint:study:daily'&&x.value.currentIndex===3));
  await context.close();await launch(true);
  await page.goto(sessionUrl,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Daily session complete'}).waitFor();
  check('completed daily session restores after offline process restart');
  await page.getByRole('button',{name:'Undo last rating'}).click();
  await page.locator('.study-session').getByText('tres',{exact:true}).waitFor();
  saved=await pollRecords(r=>r.some(x=>x.key.startsWith('review:undo:'))&&r.some(x=>x.key==='checkpoint:study:daily'&&x.value.currentIndex===2));
  check('last-card undo after cold completion restores last card and queues undo');
  await page.screenshot({path:join(artifacts,'03-offline-undo.png')});
  const queued=saved.filter(x=>x.key.startsWith('review:')).map(x=>x.value).sort((a,b)=>a.sequence-b.sequence);
  offline=false;await context.setOffline(false);
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  for(let i=0;i<100&&!writes.length;i++)await delay(100);
  assert(writes.length>0,'Reconnect should attempt sync');
  assert.equal((await records()).filter(x=>x.key.startsWith('review:')).length,queued.length,'recorded:false must not drop events');
  check('HTTP 200 without recorded:true retains every queued event');
  acknowledge=true;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await pollRecords(r=>r.filter(x=>x.key.startsWith('review:')).length===0);
  const acked=writes.filter(x=>x.acknowledged);
  assert.deepEqual(acked.map(x=>[x.eventId,x.method]),queued.map(x=>[x.eventId,x.operation==='undo'?'DELETE':'POST']));
  assert.equal(accepted.size,2);
  check('reconnection sync preserves IDs/order and final undo result',{acknowledged:acked.length,serverRatedCards:accepted.size});
  await page.screenshot({path:join(artifacts,'04-reconnected.png')});
  // Seed a genuine stale completed Home response: first sync all three, then undo offline.
  await rate('Secure');
  await page.getByRole('heading',{name:'Daily session complete'}).waitFor();
  await pollRecords(r=>r.filter(x=>x.key.startsWith('review:')).length===0);
  assert.equal(accepted.size,3);
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('button',{name:/Daily study finished/}).waitFor();
  await pollRecords(r=>r.some(x=>x.key==='query:/api/library'&&x.value.dailyStudy.completed===3));
  check('online Home caches acknowledged 3/3 completion');
  offline=true;await context.setOffline(true);
  await page.getByRole('button',{name:/Daily study finished/}).click();
  await page.getByRole('heading',{name:'Daily session complete'}).waitFor();
  await page.getByRole('button',{name:'Study more',exact:true}).click();
  await page.getByText('Start Studying',{exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/study');
  check('offline completed-session Study more button navigates to prepared shell');
  await page.goto(sessionUrl,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Daily session complete'}).waitFor();
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('button',{name:/Daily study finished/}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/');
  check('offline completed-session Home button navigates to prepared library');
  await page.getByRole('button',{name:/Daily study finished/}).click();
  await page.getByRole('button',{name:'Undo last rating'}).click();
  await page.locator('.study-session').getByText('tres',{exact:true}).waitFor();
  await pollRecords(r=>r.some(x=>x.key.startsWith('review:undo:')));
  await page.getByRole('link',{name:'Huella',exact:true}).click();
  await page.getByText('1 left · 2 of 3 complete',{exact:true}).waitFor();
  saved=await records();
  assert.equal(saved.find(x=>x.key==='query:/api/library').value.dailyStudy.completed,3,'Stale server cache must still say complete');
  assert.equal(saved.find(x=>x.key==='checkpoint:study:daily').value.stats.cardsReviewed,2);
  check('offline Home uses pending undo over stale 3/3 server count',{home:'1 left · 2 of 3 complete',cachedServerCompleted:3});
  await page.screenshot({path:join(artifacts,'05-offline-home-pending-undo.png')});
  // A saved local identity must work even without a usable Supabase credential.
  await context.clearCookies();await context.close();await launch(true);
  const localOnly=await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  assert(localOnly.fromServiceWorker());
  await page.getByText('1 left · 2 of 3 complete',{exact:true}).waitFor();
  assert.equal((await context.cookies()).filter(c=>c.name.startsWith('sb-')).length,0);
  check('offline process restart restores local account and pending Home count without auth cookies');
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:origin,sameSite:'Lax',expires}]);
  offline=false;await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await pollRecords(r=>r.filter(x=>x.key.startsWith('review:')).length===0);
  assert.equal(accepted.size,2);
  check('Home pending undo subsequently syncs to fixture API');
  staleHome=true;
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.getByText('Today’s progress awaiting sync',{exact:false}).waitFor();
  assert.equal(await page.getByText('✓ Goal reached',{exact:true}).count(),0);
  check('previous day’s cached 120 reviews never claim today’s goal');
  staleHome=false;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('2 / 3',{exact:true}).waitFor();
  check('current dated Home total restores after successful refresh');
  failPreparation=true;
  await page.goto(origin+'/account/downloads',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Sync now',exact:true}).click();
  await page.getByText('Library saved · some files are still waiting to sync',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>navigator.onLine),true);
  check('online server failure preserves available library and reports partial sync');
  failPreparation=false;
  await page.getByRole('button',{name:'Sync now',exact:true}).click();
  await page.getByText('Library saved on this device',{exact:true}).waitFor({timeout:60000});
  check('sync retry recovers without clearing study data');



}catch(error){failures.push({type:'test',message:error.stack});console.error(error);try{await page.screenshot({path:join(artifacts,'failure.png'),timeout:3000});await writeFile(join(artifacts,'failure-body.txt'),await page.locator('body').innerText());await writeFile(join(artifacts,'failure-records.json'),JSON.stringify(await records(),null,2));}catch{}process.exitCode=1;}
finally{
  await writeFile(join(artifacts,'report.json'),JSON.stringify({build,buildId:(await readFile(join(build,'.next/BUILD_ID'),'utf8')).trim(),checks,failures,writes,blockedExternal,requests},null,2));
  await context?.close().catch(()=>{});server.kill('SIGTERM');proxy.closeAllConnections();tlsProxy.closeAllConnections();for(const socket of sockets)socket.destroy();await Promise.all([gateway,proxy,tlsProxy].map(server=>new Promise(r=>server.close(r))));serverLog.end();console.log('ARTIFACTS',artifacts);
}
