import "fake-indexeddb/auto";
import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("@/lib/device-media",()=>({deviceOwner:vi.fn()}));
import {deviceOwner} from "@/lib/device-media";
import {writeRecord,readRecord} from "@/lib/device-db";
import {selectLocalStudy, type LocalDeckView} from "@/lib/local-library";
import {queueReview,queueUndo} from "@/lib/review-outbox";
import {projectLocalProgress} from "@/lib/local-progress";
const now=new Date("2026-11-19T12:00:00Z");
let owner:string;
const card=(id:string)=>({id,front:id,back:`English ${id}`,hint:null,imageUrl:null,imageTier:null,tags:null,createdAt:"2026-01-01",nextReviewAt:"2026-01-01",easeFactor:2.5,interval:0,repetitions:0,recallStates:[],reviews:[]});
beforeEach(async()=>{
 owner=crypto.randomUUID();vi.mocked(deviceOwner).mockResolvedValue(owner);
 vi.stubGlobal("navigator",{onLine:false});vi.stubGlobal("window",{dispatchEvent:vi.fn()});vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("No connection")));
 await writeRecord(owner,"library:manifest",{deckIds:["a","b"],timeZone:"Europe/London",learningLanguage:"es",syncedAt:Date.now()});
 for(const id of ["a","b"])await writeRecord(owner,`query:/api/decks/${id}/view`,{deck:{id,name:id,emoji:null,cards:Array.from({length:5},(_,i)=>card(`${id}${i}`))},learningLanguage:"es"});
});
describe("local-first library",()=>{
 it("starts an unprepared custom selection offline and shows every unique card before repeats",async()=>{
  const result=await selectLocalStudy(owner,new URLSearchParams("filter=random&deckIds=b&limit=7"),now);
  expect(result?.cards).toHaveLength(7);expect(new Set(result?.cards.slice(0,5).map(c=>c.id)).size).toBe(5);expect(result?.cards.every(c=>c.id.startsWith("b"))).toBe(true);expect(fetch).not.toHaveBeenCalled();
 });
 it("creates the next day's daily plan offline, keeping it durable without declaring completion",async()=>{
  await writeRecord(owner,"study:daily",{cards:[],daily:{day:"2026-11-18",completed:120,total:120},learningLanguage:"es"});
  const data=await selectLocalStudy(owner,new URLSearchParams("filter=daily"),now);
  expect(data?.cards).toHaveLength(10);expect(data?.daily).toMatchObject({day:"2026-11-19",completed:0,total:10});
  expect((await readRecord(owner,"plan:2026-11-19"))?.value).toMatchObject({day:"2026-11-19"});
  expect((await selectLocalStudy(owner,new URLSearchParams("filter=daily"),now))?.cards.map(c=>c.id)).toEqual(data?.cards.map(c=>c.id));
 });
 it("never reads another account's library",async()=>{expect(await selectLocalStudy("someone-else",new URLSearchParams(),now)).toBeNull();});
 it("applies an offline rating to scheduling and undoes it without a server",async()=>{
  await queueReview("a0",4,"front");
  const first=await selectLocalStudy(owner,new URLSearchParams("filter=due&deckIds=a&orientation=front"),new Date());
  expect(first?.cards.some(c=>c.id==="a0")).toBe(false);
  const review=await queueReview("a1",4,"front");await queueUndo(review);
  const next=await selectLocalStudy(owner,new URLSearchParams("filter=due&deckIds=a&orientation=front"),new Date());
  expect(next?.cards.some(c=>c.id==="a1")).toBe(true);
 });
 it("does not apply an acknowledged server rating twice when the acknowledgement was lost",async()=>{
  const event=await queueReview("a0",4,"front");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${owner}:${event.eventId}`));
  const id=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,"0")).join("");
  const record=(await readRecord<LocalDeckView>(owner,"query:/api/decks/a/view"))!;
  record.value.deck.cards[0].reviews=[{id,quality:4,reviewedAt:new Date(event.reviewedAt)} as never];
  await writeRecord(owner,record.key,record.value);
  const data=await selectLocalStudy(owner,new URLSearchParams("filter=created&deckIds=a"),now);
  const first=data?.cards[0] as unknown as {reviews:unknown[]};
  expect(first.reviews).toHaveLength(1);
 });
 it("honours archived packs and tags",async()=>{
  const view=(await readRecord<LocalDeckView>(owner,"query:/api/decks/a/view"))!.value;
  view.deck.archivedAt=new Date().toISOString();await writeRecord(owner,"query:/api/decks/a/view",view);
  expect((await selectLocalStudy(owner,new URLSearchParams("filter=random&limit=10"),now))?.cards.every(c=>c.id.startsWith("b"))).toBe(true);
  expect((await selectLocalStudy(owner,new URLSearchParams("filter=random&tags=missing"),now))?.cards).toHaveLength(0);
 });
 it("shows pending reviews in today's home count and reverses an undo",async()=>{
  const baseline=Date.now()-100;const today=new Date();
  const review=await queueReview("a1",4,"front");
  const home={cardsReviewedToday:0,reviewDay:today.toLocaleDateString("en-CA",{timeZone:"Europe/London"}),reviewTimeZone:"Europe/London"};
  expect((await projectLocalProgress(owner,"/api/library",home,baseline,today)).cardsReviewedToday).toBe(1);
  await queueUndo(review);
  expect((await projectLocalProgress(owner,"/api/library",home,baseline,today)).cardsReviewedToday).toBe(0);
 });
});

describe('offline progress after reconnect and calendar changes',()=>{
 it('extends the calendar to the current month without needing the server',async()=>{
  const review=await queueReview('a1',4,'front');const day=review.reviewedAt.slice(0,10);
  const data={calendarMonth:[{date:'2026-10-01',count:7}],dailyCounts:[{date:'2026-10-31',count:0}],heatmapData:[],cardsReviewedToday:0,totalReviews:0,dailyGoal:10};
  const result=await projectLocalProgress(owner,'/api/stats?period=7',data,Date.now()-1000,new Date(review.reviewedAt));
  expect(result.calendarMonth.find(r=>r.date===day)?.count).toBe(1);expect(result.dailyCounts).toHaveLength(7);
 });
 it('does not count a deleted reviewed card toward unfinished daily cards',async()=>{
  await writeRecord(owner,'study:daily',{cards:[],daily:{day:'2026-11-19',total:3,timingKey:'k',completed:0}});
  await writeRecord(owner,'checkpoint:study:daily',{cards:[],dailyDay:'2026-11-19',timingKey:'k',currentIndex:2,progressOffset:0,stats:{cardsReviewed:3}});
  const result=await projectLocalProgress(owner,'/api/library',{dailyStudy:{completed:0}},Date.now(),now);
  expect(result.dailyStudy.completed).toBe(2);
 });
});

it('does not silently classify an older downloaded pack with missing history as new',async()=>{
 const r=(await readRecord<LocalDeckView>(owner,'query:/api/decks/a/view'))!;
 delete (r.value.deck.cards[0] as Partial<typeof r.value.deck.cards[0]>).reviews;
 delete (r.value.deck.cards[0] as Partial<typeof r.value.deck.cards[0]>).recallStates;
 await writeRecord(owner,r.key,r.value);
 await expect(selectLocalStudy(owner,new URLSearchParams('filter=daily'),now)).rejects.toThrow('learning history');
 expect(await readRecord(owner,'plan:2026-11-19')).toBeUndefined();
});
it('restores missing history online and preserves pending offline ratings before choosing a daily set',async()=>{
 const r=(await readRecord<LocalDeckView>(owner,'query:/api/decks/a/view'))!;
 const restored=structuredClone(r.value);
 restored.deck.cards[0].reviews=[{quality:4,reviewedAt:new Date('2026-11-17')}];
 delete (r.value.deck.cards[0] as Partial<typeof r.value.deck.cards[0]>).reviews;
 await writeRecord(owner,r.key,r.value);
 const event=await queueReview('a1',4,'front');
 vi.stubGlobal('navigator',{onLine:true});
 vi.mocked(fetch).mockResolvedValue(Response.json(restored));
 const data=await selectLocalStudy(owner,new URLSearchParams('filter=daily'),now);
 expect(data?.daily?.picks?.find(p=>p.id==='a0')?.group).toBe('retention');
 expect(data?.daily?.picks?.find(p=>p.id==='a1')?.group).toBe('retention');
 expect(data?.daily?.resultContext?.historyComplete).toBe(true);
 expect(await readRecord(owner,'review:'+event.eventId)).toBeDefined();
});
