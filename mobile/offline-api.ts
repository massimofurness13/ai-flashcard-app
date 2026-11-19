/* eslint-disable @typescript-eslint/no-explicit-any -- Projects existing JSON API documents without importing server models. */
import {readRecord,writeRecords,listRecords,deleteRecord} from "@/lib/device-db";
import {readDeviceIdentity} from "@/lib/device-identity";
import {offlineMutationSchema,type OfflineMutation} from "@/lib/offline-mutation-schema";
import {patchSavedStudy} from "./study-edits";
import type {SavedStudy} from "@/lib/offline-study";
import type {StudyResumeSnapshot} from "@/lib/study-resume";
export type PendingMutation=OfflineMutation & {sequence:number;error?:string};
let chain=Promise.resolve();
let flushing:Promise<void>|undefined;
const object=(value:unknown):Record<string,any>=>value&&typeof value==="object"?value as Record<string,any>:{};
const currentOwner=()=>readDeviceIdentity(localStorage)?.id;
export function supportsLocalWrite(path:string,method:string){return (method==="PATCH"||method==="DELETE")&&/^\/api\/(cards|decks)\/[^/]+$/.test(path)||method==="POST"&&(/^\/api\/decks\/[^/]+\/cards$/.test(path)||["/api/decks","/api/folders"].includes(path))||method==="PATCH"&&path==="/api/user/daily-goal";}
const blankCard=(op:any)=>({id:op.id,deckId:op.deckId,...op.fields,hint:op.fields.hint??null,tags:op.fields.tags??null,imageUrl:op.fields.imageUrl??null,imageTier:op.fields.imageTier??null,createdAt:op.at,updatedAt:op.at,position:999999,easeFactor:2.5,interval:0,repetitions:0,nextReviewAt:op.at,recallStates:[],reviews:[]});
const blankDeck=(op:any)=>({id:op.id,...op.fields,description:op.fields.description??null,folderId:op.fields.folderId??null,folder:null,frontVoice:null,backVoice:null,frontLanguageCode:op.fields.frontLanguageCode??null,backLanguageCode:op.fields.backLanguageCode??null,cards:[],_count:{cards:op.cards?.length??0},grade:"New",archivedAt:null,createdAt:op.at,updatedAt:op.at,lastStudiedAt:null});
export function projectMutation(url:string,input:any,pending:PendingMutation[]):any{
 const data=structuredClone(input);
 for(const item of pending.flatMap(item=>item.operation.kind==="cards:create"?item.operation.cards.map(({id,...fields})=>({...item,operation:{kind:"card:create" as const,id,deckId:(item.operation as Extract<OfflineMutation["operation"],{kind:"cards:create"}>).deckId,fields}})):item)){
  const op:any={...item.operation,at:new Date(item.sequence).toISOString()};
  const updateDeck=(deck:any)=>{
   if(op.kind==="deck:delete"&&deck.id===op.id)deck.archivedAt=op.at;
   if(op.kind==="deck:update"&&deck.id===op.id){Object.assign(deck,op.fields);if(op.fields.archive!==undefined)deck.archivedAt=op.fields.archive?op.at:null;}
   if(op.kind.startsWith("card:")&&Array.isArray(deck.cards)){
    if(op.kind==="card:update")deck.cards=deck.cards.map((c:any)=>c.id===op.id?{...c,...op.fields}:c);
    if(op.kind==="card:delete")deck.cards=deck.cards.filter((c:any)=>c.id!==op.id);
    if(op.kind==="card:create"&&deck.id===op.deckId&&!deck.cards.some((c:any)=>c.id===op.id))deck.cards.push({...blankCard(op),deck:{id:deck.id,name:deck.name,emoji:deck.emoji,frontLanguageCode:deck.frontLanguageCode,backLanguageCode:deck.backLanguageCode}});
    deck._count={...deck._count,cards:deck.cards.length};
   }
   return deck;
  };
  if(/^\/api\/decks\/[^/]+\/view$/.test(url)&&data.deck)updateDeck(data.deck);
  if(url==="/api/library/extras"&&Array.isArray(data.archivedDecks)){
   data.archivedDecks=data.archivedDecks.map(updateDeck).filter((d:any)=>!(op.kind==="deck:delete"&&d.id===op.id)&&!(op.kind==="deck:update"&&op.id===d.id&&op.fields.archive===false));
  }
  if(url==="/api/study-config"&&Array.isArray(data.decks)){
   if(op.kind==="deck:create"&&!data.decks.some((d:any)=>d.id===op.id))data.decks.push(blankDeck(op));
   data.decks=data.decks.map(updateDeck).filter((d:any)=>!(op.kind==="deck:delete"&&d.id===op.id)&&!d.archivedAt);
  }
  if(url==="/api/library"){
   const decks=[...(data.unfolderedDecks||[]),...(data.folders||[]).flatMap((f:any)=>f.decks||[])].map(updateDeck);
   if(op.kind==="deck:create"&&!decks.some(d=>d.id===op.id))decks.push(blankDeck(op));
   if(op.kind==="folder:create"&&!data.folders.some((f:any)=>f.id===op.id))data.folders.push({id:op.id,...op.fields,decks:[]});
   const available=decks.filter(d=>!(op.kind==="deck:delete"&&d.id===op.id)&&!d.archivedAt);
   data.unfolderedDecks=available.filter(d=>!d.folderId);
   data.folders=(data.folders||[]).map((f:any)=>({...f,decks:available.filter(d=>d.folderId===f.id)}));
   if(op.kind==="user:goal")data.dailyGoal=op.dailyGoal;
  }
  if(url.startsWith("/api/stats")&&op.kind==="user:goal")data.dailyGoal=op.dailyGoal;
  if(url==="/api/folders"&&Array.isArray(data)&&op.kind==="folder:create"&&!data.some(d=>d.id===op.id))data.push({id:op.id,...op.fields});
 }
 return data;
}
export async function pendingMutations(owner:string){return (await listRecords(owner,"mutation:")).map(r=>r.value as PendingMutation).sort((a,b)=>a.sequence-b.sequence);}
function includeRestoredPack(url:string,input:any,deck:any){
 const data=structuredClone(input),metadata={...deck,_count:{cards:deck.cards?.length??deck._count?.cards??0}};
 if(url==="/api/study-config"&&!data.decks?.some((d:any)=>d.id===deck.id))data.decks=[...(data.decks||[]),metadata];
 if(url==="/api/library"){
  const all=[...(data.unfolderedDecks||[]),...(data.folders||[]).flatMap((f:any)=>f.decks||[])];
  if(!all.some((d:any)=>d.id===deck.id))data.unfolderedDecks=[...(data.unfolderedDecks||[]),metadata];
 }
 return data;
}
export async function projectPending(url:string,data:unknown){
 const owner=currentOwner();if(!owner)return data;
 const pending=await pendingMutations(owner);
 for(const item of pending)if(item.operation.kind==="deck:update"&&item.operation.fields.archive===false){
  const deck=object((await readRecord(owner,`query:/api/decks/${item.operation.id}/view`))?.value).deck;
  if(deck)data=includeRestoredPack(url,data,deck);
 }
 return projectMutation(url,data,pending);
}
export async function cachedApi(url:string){
 const owner=currentOwner();if(!owner)return undefined;
 const record=await readRecord(owner,`query:${url}`);if(record)return record.value;
 const deckId=url.match(/^\/api\/decks\/([^/]+)\/cards$/)?.[1];if(deckId)return object((await readRecord(owner,`query:/api/decks/${deckId}/view`))?.value).deck?.cards;
 if(url==="/api/stats")return (await readRecord(owner,"query:/api/stats?period=7"))?.value;
 if(url==="/api/folders")return object((await readRecord(owner,"query:/api/library"))?.value).folders??[];
 return undefined;
}
export function saveLocalWrite(url:string,method:string,body:unknown):Promise<Response>{
 const result=chain.then(()=>save(url,method,body));chain=result.then(()=>{},()=>{});return result;
}
async function save(url:string,method:string,input:unknown){
 const body=object(input);
 const owner=currentOwner();if(!owner)throw Error("Choose your account before saving.");
 const records=await listRecords(owner,"query:");
 const views=records.filter(r=>/^query:\/api\/decks\/[^/]+\/view$/.test(r.key)).map(r=>object(r.value));
 let operation:any,result:any;
 const cardId=url.match(/^\/api\/cards\/([^/]+)$/)?.[1],deckId=url.match(/^\/api\/decks\/([^/]+)$/)?.[1],newCardDeck=url.match(/^\/api\/decks\/([^/]+)\/cards$/)?.[1];
 const base=(current:any,fields:any)=>Object.fromEntries(Object.keys(fields).map(key=>[key,key==="archive"?!!current.archivedAt:current[key]??null]));
 if(cardId){const card=views.flatMap(v=>v.deck.cards).find(c=>c.id===cardId);if(!card)throw Error("This card has not been saved on this device.");
  operation=method==="DELETE"?{kind:"card:delete",id:cardId,base:base(card,{front:0,back:0})}:{kind:"card:update",id:cardId,fields:body,base:base(card,body)};result=method==="DELETE"?{success:true}:{...card,...body};
 }else if(deckId){const deck=views.find(v=>v.deck.id===deckId)?.deck;if(!deck)throw Error("This pack has not been saved on this device.");
  operation=method==="DELETE"?{kind:"deck:delete",id:deckId,base:base(deck,{name:0})}:{kind:"deck:update",id:deckId,fields:body,base:base(deck,body)};result=method==="DELETE"?{success:true}:{...deck,...body};
 }else if(newCardDeck){
  if(Array.isArray(input)){operation={kind:"cards:create",deckId:newCardDeck,cards:input.map(fields=>({id:crypto.randomUUID(),...fields}))};result=operation.cards.map(({id,...fields}:any)=>blankCard({id,deckId:newCardDeck,fields,at:new Date().toISOString()}));}
  else {operation={kind:"card:create",id:crypto.randomUUID(),deckId:newCardDeck,fields:body};result=blankCard({...operation,at:new Date().toISOString()});}
 }
 else if(url==="/api/decks"){
  const {cards,...fields}=body;operation={kind:"deck:create",id:crypto.randomUUID(),fields,...(Array.isArray(cards)&&cards.length?{cards:cards.map(c=>({id:crypto.randomUUID(),...c}))}:{})};
  result=blankDeck({...operation,at:new Date().toISOString()});
  if(operation.cards){result.cards=operation.cards.map(({id,...fields}:any)=>({...blankCard({id,deckId:operation.id,fields,at:new Date().toISOString()}),deck:{id:result.id,name:result.name,emoji:result.emoji,frontLanguageCode:result.frontLanguageCode,backLanguageCode:result.backLanguageCode}}));result._count.cards=result.cards.length;}
 }
 else if(url==="/api/folders"){operation={kind:"folder:create",id:crypto.randomUUID(),fields:body};result={id:operation.id,...body};}
 else {operation={kind:"user:goal",dailyGoal:body.dailyGoal};result={dailyGoal:body.dailyGoal};}
 const parsed=offlineMutationSchema.safeParse({eventId:crypto.randomUUID(),operation});
 if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message||"Invalid edit"},{status:400});
 const previous=await pendingMutations(owner);
 const item:PendingMutation={...parsed.data,sequence:Math.max(Date.now(),...previous.map(p=>p.sequence+1))};
 const restored=operation.kind==="deck:update"&&operation.fields.archive===false?views.find(v=>v.deck.id===operation.id)?.deck:null;
 const updates:Array<{key:string;value:unknown;savedAt?:number}>=records.map(r=>({key:r.key,value:projectMutation(r.key.slice(6),restored?includeRestoredPack(r.key.slice(6),r.value,restored):r.value,[item]),savedAt:r.savedAt}));
 if(operation.kind==="deck:create"){
  updates.push({key:`query:/api/decks/${operation.id}/view`,value:{deck:result,isPro:false,canViewAiImages:true,learningLanguage:"es",overallGrade:"New",avgMastery:0,gradeDistribution:{A:0,B:0,C:0,D:0,F:0,New:0}}});
  const manifest=object((await readRecord(owner,"library:manifest"))?.value);updates.push({key:"library:manifest",value:{...manifest,deckIds:[...(manifest.deckIds||[]),operation.id]}});
 }
 if(operation.kind==="deck:delete"){
  const manifest=object((await readRecord(owner,"library:manifest"))?.value);
  updates.push({key:"library:manifest",value:{...manifest,deckIds:(manifest.deckIds||[]).filter((id:string)=>id!==operation.id)}});
 }
 for(const prefix of ["study:","checkpoint:study:"]){
  for(const record of await listRecords(owner,prefix))updates.push({key:record.key,value:patchSavedStudy(record.value as SavedStudy|StudyResumeSnapshot,parsed.data.operation),savedAt:record.savedAt});
 }
 // Counts derive from the complete local pack, not a guessed delta applied twice.
 const counts=new Map(updates.filter(r=>/^query:\/api\/decks\/[^/]+\/view$/.test(r.key)).map(r=>{const deck=object(r.value).deck;return [deck.id,deck.cards.length];}));
 for(const update of updates){const data=object(update.value);if(["query:/api/library","query:/api/study-config"].includes(update.key)){
  const decks=[...(data.decks||[]),...(data.unfolderedDecks||[]),...(data.folders||[]).flatMap((f:any)=>f.decks||[])];
  for(const deck of decks)if(counts.has(deck.id))deck._count={...deck._count,cards:counts.get(deck.id)};
 }}
 updates.push({key:`mutation:${item.eventId}`,value:item});
 await writeRecords(owner,updates);
 for(const update of updates)if(update.key.startsWith("query:"))window.dispatchEvent(new CustomEvent("huella:device-saved",{detail:{owner,url:update.key.slice(6)}}));
 window.dispatchEvent(new Event("huella:edits"));return Response.json(result,{status:method==="POST"?201:200});
}
export function flushMutations(send:(body:OfflineMutation)=>Promise<Response>){
 if(flushing)return flushing;
 flushing=(async()=>{
  const owner=currentOwner();if(!owner||navigator.onLine===false)return;
  for(const item of await pendingMutations(owner)){
   if(currentOwner()!==owner)return;
   // Existing reviews/plans must reach the server before a destructive edit.
   // Creates and corrections can pass a deferred delete so new-card reviews
   // never wait for a delete which is itself waiting for those reviews.
   if(item.operation.kind==="card:delete"||item.operation.kind==="deck:delete"){
    if((await listRecords(owner,"review:")).length||(await listRecords(owner,"plan:")).some(r=>!object(r.value).error))continue;
   }
   try{
    const response=await send({eventId:item.eventId,operation:item.operation});
    const data=await response.json();
    if(!response.ok||data.recorded!==true){
     if([400,404,409].includes(response.status))await writeRecords(owner,[{key:`mutation:${item.eventId}`,value:{...item,error:data.error||"This edit needs attention."}}]);
     break;
    }
    await deleteRecord(owner,`mutation:${item.eventId}`);
   }catch{break;}
  }
  window.dispatchEvent(new Event("huella:edits-synced"));
 })().finally(()=>{flushing=undefined;});return flushing;
}
