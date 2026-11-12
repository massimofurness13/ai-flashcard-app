import {isRetentionCard} from "@/lib/recall-history";
import {describe,it,expect} from "vitest";
import {buildDailyPlan,dailyProgress,recallBand} from "@/lib/daily-study";
import {scheduleDirection,type StudyCandidate,type RecallState} from "@/lib/study-selection";
const now=new Date("2026-11-11T12:00:00Z"),future=new Date(now.getTime()+86400000);
function state(direction:string,lastQuality=4):RecallState{return {direction,lastQuality,lastReviewedAt:new Date(0),nextReviewAt:future,easeFactor:2.5,interval:6,repetitions:2};}
function card(id:string,kind:"weak"|"secure"|"new"):StudyCandidate {
 return {id,front:id,tags:null,createdAt:new Date(0),nextReviewAt:new Date(0),easeFactor:2.5,interval:0,repetitions:0,
  recallStates:kind==="secure"?[state("front"),state("back")]:kind==="weak"?[state("front",1)]:[],
  reviews:kind==="new"?[]:[{quality:kind==="weak"?1:4,reviewedAt:new Date(0)}]};
}
const pool=(weak:number,secure:number,fresh:number)=>[
 ...Array.from({length:weak},(_,i)=>card("w"+i,"weak")),...Array.from({length:secure},(_,i)=>card("s"+i,"secure")),...Array.from({length:fresh},(_,i)=>card("n"+i,"new"))];
const counts=(p:ReturnType<typeof buildDailyPlan>)=>["practice","retention","new"].map(g=>p.filter(x=>x.group===g).length);
describe("daily 150 with fixed learning and retention allocations",()=>{
 it("uses 100 practice and 50 retention without forcing new words",()=>{
  const picks=buildDailyPlan(pool(140,100,100),now);
  expect(counts(picks)).toEqual([100,50,0]);expect(new Set(picks.map(p=>p.id)).size).toBe(150);
 });
 it("fills the 100 learning slots with practice first and then new cards without a ten-card cap",()=>{
  expect(counts(buildDailyPlan(pool(50,100,100),now))).toEqual([50,50,50]);
  expect(counts(buildDailyPlan(pool(40,100,100),now))).toEqual([40,50,60]);
  expect(counts(buildDailyPlan(pool(0,100,200),now))).toEqual([0,50,100]);
 });
 it("keeps retention at 50 even when more secure cards are overdue",()=>{
  const cards=pool(40,100,100);for(const c of cards.filter(isRetentionCard)) for(const s of c.recallStates)s.nextReviewAt=new Date(0);
  expect(counts(buildDailyPlan(cards,now))).toEqual([40,50,60]);
 });
 it("never replaces missing retention with extra learning or duplicate cards",()=>{
  const picks=buildDailyPlan(pool(0,0,200),now);
  expect(picks).toHaveLength(100);expect(new Set(picks.map(p=>p.id)).size).toBe(100);
  expect(counts(buildDailyPlan(pool(70,10,100),now))).toEqual([70,10,30]);
  expect(buildDailyPlan([],now)).toEqual([]);
 });
 it("returns a shorter set when learning runs out rather than exceeding 50 retention",()=>{
  expect(counts(buildDailyPlan(pool(5,100,2),now))).toEqual([5,50,2]);
 });
 it("selects the 50 earliest-due retention cards and keeps practice within 100",()=>{
  const cards=pool(200,80,200);
  for(const [i,c] of cards.filter(isRetentionCard).entries()) {
   for(const s of c.recallStates) s.nextReviewAt=new Date(now.getTime()+i*86400000);
  }
  const picks=buildDailyPlan(cards,now);
  expect(counts(picks)).toEqual([100,50,0]);
  expect(picks.filter(p=>p.group==="retention").map(p=>p.id).sort()).toEqual(Array.from({length:50},(_,i)=>"s"+i).sort());
 });
 it("introduces older Pack 3 cards before Pack 4 regardless of input order",()=>{
  const older=Array.from({length:12},(_,i)=>({...card(`pack3-${String(i).padStart(2,"0")}`,"new"),createdAt:new Date("2026-11-10")}));
  const newer=Array.from({length:20},(_,i)=>({...card(`pack4-${i}`,"new"),createdAt:new Date("2026-11-11")}));
  const first=buildDailyPlan([...pool(90,50,0),...newer,...older.slice().reverse()],now).filter(p=>p.group==="new");
  expect(first.map(p=>p.id).sort()).toEqual(older.slice(0,10).map(c=>c.id));
  // Once those ten have been introduced, the next batch drains the older remainder first.
  const next=buildDailyPlan([...pool(90,50,0),...newer,...older.slice(10)],now).filter(p=>p.group==="new");
  expect(next.map(p=>p.id)).toEqual(expect.arrayContaining(older.slice(10).map(c=>c.id)));
  expect(next.filter(p=>p.id.startsWith("pack4-")).length).toBe(8);
 });
 it("includes historical known cards in retention without inventing directional records",()=>{
  const c=card("old","new");c.reviews=[{quality:4,reviewedAt:new Date(0)}];
  expect(c.recallStates).toEqual([]);
  expect(counts(buildDailyPlan([c],now))).toEqual([0,1,0]);
  expect([0,1,2,3,4,5].map(recallBand)).toEqual(["unrated","dont-know","kind-of","secure","secure","secure"]);
 });
 it("shortens the Kind of retry to one day even after a long interval",()=>{
  const next=scheduleDirection(2,state("front"),now);
  expect(next).toMatchObject({interval:1,repetitions:0,nextReviewAt:future});
 });
 it("keeps unfinished learning cards ahead of other weak cards and replaces only promoted cards",()=>{
  const original=pool(100,80,30);
  const yesterday=buildDailyPlan(original,now,()=>0.5);
  const learning=yesterday.filter(p=>p.group!=="retention");
  const promoted=new Set(learning.slice(0,7).map(p=>p.id));
  const updated=original.map(c=>promoted.has(c.id)?{...c,reviews:[{quality:4,reviewedAt:now}]}:c);
  // Promotion frees exactly seven places; the other 93 stay in the cohort.
  const next=buildDailyPlan(updated,now,()=>0.2,yesterday);
  const nextLearning=next.filter(p=>p.group!=="retention");
  expect(nextLearning).toHaveLength(100);
  expect(nextLearning.map(p=>p.id)).toEqual(expect.arrayContaining(learning.slice(7).map(p=>p.id)));
  expect(nextLearning.filter(p=>promoted.has(p.id))).toHaveLength(0);
  expect(nextLearning.filter(p=>p.group==="new")).toHaveLength(7);
 });
 it("does not eject unfinished cohort members when other weak cards are waiting",()=>{
  const yesterday=buildDailyPlan(pool(100,50,0),now,()=>0.5);
  const next=buildDailyPlan([...pool(100,50,0),...Array.from({length:100},(_,i)=>card("aaa-waiting"+i,"weak"))],now,()=>0.2,yesterday);
  expect(next.filter(p=>p.group==="practice").map(p=>p.id).sort()).toEqual(yesterday.filter(p=>p.group==="practice").map(p=>p.id).sort());
 });
 it("keeps unreviewed new cards in the active cohort and drops archived/deleted cards",()=>{
  const previous=buildDailyPlan(pool(0,50,100),now,()=>0.5);
  const retained=previous.find(p=>p.group==="new")!;
  const cards=[card(retained.id,"new"),...pool(200,60,0)];
  const next=buildDailyPlan(cards,now,()=>0.5,previous);
  expect(next.some(p=>p.id===retained.id)).toBe(true);
  expect(next.some(p=>p.id.startsWith("n")&&p.id!==retained.id)).toBe(false);
  expect(new Set(next.map(p=>p.id)).size).toBe(next.length);
 });
 it("gives one partial retention recall a next-session retry; a second moves it to learning",()=>{
  const partial={...card("partial","secure"),reviews:[{quality:2,reviewedAt:now},{quality:4,reviewedAt:new Date(0)}]};
  const first=buildDailyPlan([...pool(150,100,0),partial],now);
  expect(first.find(p=>p.id==="partial")?.group).toBe("retention");
  partial.reviews=[{quality:2,reviewedAt:now},{quality:2,reviewedAt:new Date(0)}];
  expect(buildDailyPlan([partial],now)[0].group).toBe("practice");
  partial.reviews=[{quality:1,reviewedAt:now},{quality:4,reviewedAt:new Date(0)}];
  expect(buildDailyPlan([partial],now)[0].group).toBe("practice");
 });
 it("resumes the same set without counting retries, other faces or passive views",()=>{
  const picks=buildDailyPlan(pool(3,0,0),now,()=>0.5);
  const first=picks[0];
  const progress=dailyProgress(picks,[{cardId:first.id,direction:first.studyDirection,quality:2},{cardId:first.id,direction:first.studyDirection,quality:4},
   {cardId:picks[1].id,direction:picks[1].studyDirection,quality:0},
   {cardId:picks[2].id,direction:picks[2].studyDirection==="front"?"back":"front",quality:4}]);
  expect(progress.completed).toBe(1);expect(progress.remaining).toHaveLength(2);expect(progress.ratings).toEqual({1:0,2:1,4:0});
 });
});
