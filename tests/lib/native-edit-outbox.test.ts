import {beforeEach,describe,it,expect,vi} from "vitest";
import "fake-indexeddb/auto";
import {saveLocalWrite,pendingMutations,flushMutations} from "../../mobile/offline-api";
import {writeRecords,readRecord} from "@/lib/device-db";
import {DEVICE_IDENTITY_KEY} from "@/lib/device-identity";
let owner:string;
beforeEach(async()=>{
 owner=crypto.randomUUID();const storage=new Map<string,string>();
 vi.stubGlobal("localStorage",{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});
 localStorage.setItem(DEVICE_IDENTITY_KEY,JSON.stringify({version:1,user:{id:owner,user_metadata:{}}}));
 vi.stubGlobal("window",new EventTarget());vi.stubGlobal("navigator",{onLine:false});
 await writeRecords(owner,[{key:"query:/api/decks/d/view",value:{deck:{id:"d",name:"Pack",cards:[{id:"c",front:"uno",back:"one",hint:null,tags:null}],_count:{cards:1}}},savedAt:10},{key:"query:/api/library",value:{folders:[],unfolderedDecks:[{id:"d",name:"Pack",_count:{cards:1}}],cardsReviewedToday:0},savedAt:10}]);
});
describe("durable local edit queue",()=>{
 it("saves the correction and pending operation together without contacting a server",async()=>{
  const response=await saveLocalWrite("/api/cards/c","PATCH",{front:"corrected"});expect(response.ok).toBe(true);
  expect(await pendingMutations(owner)).toHaveLength(1);
  const record=await readRecord<{deck:{cards:{front:string}[]}}>(owner,"query:/api/decks/d/view");expect(record?.value.deck.cards[0].front).toBe("corrected");
  // Local text editing must not move the statistics' server baseline forward.
  expect((await readRecord(owner,"query:/api/library"))?.savedAt).toBe(10);
 });
 it("orders successive edits using the preceding local value as the conflict baseline",async()=>{
  await saveLocalWrite("/api/cards/c","PATCH",{front:"second"});await saveLocalWrite("/api/cards/c","PATCH",{front:"third"});
  const edits=await pendingMutations(owner);expect(edits).toHaveLength(2);expect(edits[1].operation).toMatchObject({base:{front:"second"}});expect(edits[1].sequence).toBeGreaterThan(edits[0].sequence);
 });
 it("does not try to sync when disconnected",async()=>{await saveLocalWrite("/api/cards/c","PATCH",{front:"two"});const send=vi.fn();await flushMutations(send);expect(send).not.toHaveBeenCalled();});
 it("keeps an edit when the server has not acknowledged it",async()=>{
  await saveLocalWrite("/api/cards/c","PATCH",{front:"two"});vi.stubGlobal("navigator",{onLine:true});
  await flushMutations(async()=>Response.json({recorded:false}));expect(await pendingMutations(owner)).toHaveLength(1);
 });
 it("removes only acknowledged operations",async()=>{
  await saveLocalWrite("/api/cards/c","PATCH",{front:"two"});vi.stubGlobal("navigator",{onLine:true});
  await flushMutations(async()=>Response.json({recorded:true}));expect(await pendingMutations(owner)).toHaveLength(0);
 });
 it("retains conflicting text for reconciliation",async()=>{
  await saveLocalWrite("/api/cards/c","PATCH",{front:"two"});vi.stubGlobal("navigator",{onLine:true});
  await flushMutations(async()=>Response.json({error:"Changed elsewhere"},{status:409}));expect((await pendingMutations(owner))[0].error).toBe("Changed elsewhere");
 });
 it("does not send the previous account's edits after sign-out",async()=>{
  await saveLocalWrite("/api/cards/c","PATCH",{front:"two"});vi.stubGlobal("navigator",{onLine:true});localStorage.removeItem(DEVICE_IDENTITY_KEY);
  const send=vi.fn();await flushMutations(send);expect(send).not.toHaveBeenCalled();expect(await pendingMutations(owner)).toHaveLength(1);
 });
});

describe('local pack mutations',()=>{
 it('persists a deleted card in both session records without resetting progress',async()=>{
  await writeRecords(owner,[{key:'study:daily',savedAt:100,value:{cards:[{id:'c',deck:{id:'d'}},{id:'other',deck:{id:'d'}}],daily:{day:'2026-11-19',total:2,picks:[{id:'c',group:'practice'},{id:'other',group:'retention'}]}}},{key:'checkpoint:study:daily',value:{cards:[{id:'c',deck:{id:'d'}},{id:'other',deck:{id:'d'}}],currentIndex:1,stats:{cardsReviewed:1},undoHistory:[]}}]);
  await saveLocalWrite('/api/cards/c','DELETE',{});
  expect((await readRecord<{currentIndex:number;stats:{cardsReviewed:number}}>(owner,'checkpoint:study:daily'))?.value.currentIndex).toBe(0);
  expect((await readRecord<{currentIndex:number;stats:{cardsReviewed:number}}>(owner,'checkpoint:study:daily'))?.value.stats.cardsReviewed).toBe(1);
  expect((await readRecord<{daily:{total:number}}>(owner,'study:daily'))?.value.daily.total).toBe(1);
 });
 it('removes a deleted pack from the local scheduler manifest',async()=>{
  await writeRecords(owner,[{key:'library:manifest',value:{deckIds:['d','keep']}}]);
  await saveLocalWrite('/api/decks/d','DELETE',{});
  expect((await readRecord<{deckIds:string[]}>(owner,'library:manifest'))?.value.deckIds).toEqual(['keep']);
 });
 it('sends new-card creates but defers destructive changes until reviews have uploaded',async()=>{
  await saveLocalWrite('/api/cards/c','DELETE',{});
  await saveLocalWrite('/api/decks/d/cards','POST',{front:'dos',back:'two'});
  await writeRecords(owner,[{key:'review:e',value:{cardId:'c'}}]);vi.stubGlobal('navigator',{onLine:true});
  const send=vi.fn(async(body:{operation:{kind:string}})=>Response.json({recorded:true,kind:body.operation.kind}));await flushMutations(send);
  expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0][0].operation.kind).toBe('card:create');
  expect((await pendingMutations(owner))[0].operation.kind).toBe('card:delete');
 });
});
it('restores an archived pack into the offline home and study chooser',async()=>{
 await saveLocalWrite('/api/decks/d','PATCH',{archive:true});
 await writeRecords(owner,[{key:'query:/api/study-config',value:{decks:[]}}]);
 await saveLocalWrite('/api/decks/d','PATCH',{archive:false});
 expect((await readRecord<{unfolderedDecks:{id:string}[]}>(owner,'query:/api/library'))?.value.unfolderedDecks.map(d=>d.id)).toEqual(['d']);
 expect((await readRecord<{decks:{id:string}[]}>(owner,'query:/api/study-config'))?.value.decks.map(d=>d.id)).toEqual(['d']);
});
