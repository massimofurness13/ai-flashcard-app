// Synthetic simulator data only. No customer credentials or records.
import {writeFileSync,readFileSync} from 'node:fs';
const owner='11111111-1111-4111-8111-111111111111';
const today=new Date(Date.now()-6*3600000).toISOString().slice(0,10);
const deck={id:'fixture-deck',name:'Offline fixture only',emoji:'🧪',frontLanguageCode:'es-ES',backLanguageCode:'en-US',description:null,folderId:null,folder:null,frontVoice:null,backVoice:null};
const cards=['uno','dos','tres'].map((front,i)=>({id:`fixture-card-${i+1}`,front,back:['one','two','three'][i],deckId:deck.id,deck,hint:null,tags:null,imageUrl:null,imageTier:null,createdAt:'2026-01-01',updatedAt:'2026-01-01',nextReviewAt:'2026-01-01',easeFactor:2.5,interval:0,repetitions:0,recallStates:[],reviews:[]}));
const identity={version:1,user:{id:owner,email:'offline-fixture@example.invalid',user_metadata:{full_name:'Offline fixture'}}};
const entries={
 'query:/api/library':{dailyStudy:{day:today,timeZone:'UTC',total:3,completed:0},folders:[],unfolderedDecks:[{...deck,_count:{cards:3},grade:'New',createdAt:'2026-01-01',updatedAt:'2026-01-01',lastStudiedAt:null}],totalCards:3,userName:'Offline fixture',reviewDay:today,reviewTimeZone:'UTC',cardsReviewedToday:0,dailyGoal:3,streak:0,goalHitCelebrationShown:true,onboardingCompleted:true},
 'query:/api/decks/fixture-deck/view':{deck:{...deck,cards,_count:{cards:3}},overallGrade:'New',avgMastery:0,gradeDistribution:{A:0,B:0,C:0,D:0,F:0,New:3},isPro:true,canViewAiImages:true,learningLanguage:'es'},
 'query:/api/study-config':{decks:[{...deck,_count:{cards:3},lastReviewedAt:null}]},
 'query:/api/subscription/status':{isPro:true},
 'query:/api/images/quota':{isPro:true,canViewAiImages:true,credits:1000,remaining:1000,totalRemaining:1000},
 'query:/api/user/tags':{tags:[]},
 'library:manifest':{deckIds:[deck.id],timeZone:'UTC',learningLanguage:'es',syncedAt:Date.now()},
};
// Tiny synthetic WAV and PNG exercise actual native file storage/playback.
const wav=Buffer.alloc(44+1600);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(1600,40);
for(let i=0;i<800;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/8000)*1000),44+i*2);
entries['media:fixture-audio']={__huellaBlob:true,type:'audio/wav',data:wav.toString('base64')};
entries['media:fixture-image']={__huellaBlob:true,type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII='};
const script=`Object.defineProperty(navigator,'onLine',{get:()=>false});
localStorage.setItem('huella:device-identity:v1',${JSON.stringify(JSON.stringify(identity))});
localStorage.setItem('huella-settings',JSON.stringify({defaultAutoFlip:0,defaultAutoAdvance:0,defaultCards:3}));
window.fetch=async()=>{throw new TypeError('Network disabled by isolated simulator test')};
window.addEventListener('error',e=>console.error('OFFLINE_FIXTURE_ERROR',e.message));
`;
writeFileSync(process.argv[2]||'/tmp/huella-offline-fixture.json',JSON.stringify({owner,records:Object.entries(entries).map(([key,value])=>({key,value})),script:script+readFileSync(new URL('./exercise.js',import.meta.url),'utf8')}));
if(process.argv.includes('--migration')){
 const path=process.argv[2]||'/tmp/huella-offline-fixture.json';const fixture=JSON.parse(readFileSync(path,'utf8'));
 fixture.migration=true;
 fixture.migrationSeed=`window.__huellaMigrationSeed=(async()=>{
 const q=indexedDB.open('huella-device-v1',1);const db=await new Promise((resolve,reject)=>{q.onupgradeneeded=()=>q.result.createObjectStore('records',{keyPath:['owner','key']});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
 const records=${JSON.stringify(fixture.records)};
 await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');for(const r of records){if(r.value?.__huellaBlob)r.value=new Blob([Uint8Array.from(atob(r.value.data),c=>c.charCodeAt(0))],{type:r.value.type});tx.objectStore('records').put({...r,owner:${JSON.stringify(owner)},savedAt:Date.now()});}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
 localStorage.setItem('huella:device-identity:v1',${JSON.stringify(JSON.stringify(identity))});db.close();
 })();`;
 writeFileSync(path,JSON.stringify(fixture));
}
