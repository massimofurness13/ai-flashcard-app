import {describe,it,expect} from "vitest";
import {buildDailyPlan,dailyProgress,recallBand,isSecureBothWays} from "@/lib/daily-study";
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
describe("adaptive daily 150",()=>{
 it("uses 120 practice and 30 retention without forcing new words",()=>{
  const picks=buildDailyPlan(pool(140,100,100),now);
  expect(counts(picks)).toEqual([120,30,0]);expect(new Set(picks.map(p=>p.id)).size).toBe(150);
 });
 it("fills the 120 learning slots with practice first and then new cards without a ten-card cap",()=>{
  expect(counts(buildDailyPlan(pool(50,100,100),now))).toEqual([50,30,70]);
  expect(counts(buildDailyPlan(pool(40,100,100),now))).toEqual([40,30,80]);
  expect(counts(buildDailyPlan(pool(0,100,200),now))).toEqual([0,30,120]);
 });
 it("keeps retention at 30 even when more secure cards are overdue",()=>{
  const cards=pool(40,100,100);for(const c of cards.filter(isSecureBothWays)) for(const s of c.recallStates)s.nextReviewAt=new Date(0);
  expect(counts(buildDailyPlan(cards,now))).toEqual([40,30,80]);
 });
 it("uses learning to fill unavailable retention slots without repeating cards",()=>{
  const picks=buildDailyPlan(pool(0,0,200),now);
  expect(picks).toHaveLength(150);expect(new Set(picks.map(p=>p.id)).size).toBe(150);
  expect(counts(buildDailyPlan(pool(70,10,100),now))).toEqual([70,10,70]);
  expect(buildDailyPlan([],now)).toEqual([]);
 });
 it("returns a shorter set when learning runs out rather than exceeding 30 retention",()=>{
  expect(counts(buildDailyPlan(pool(5,100,2),now))).toEqual([5,30,2]);
 });
 it("introduces older Pack 3 cards before Pack 4 regardless of input order",()=>{
  const older=Array.from({length:12},(_,i)=>({...card(`pack3-${String(i).padStart(2,"0")}`,"new"),createdAt:new Date("2026-11-10")}));
  const newer=Array.from({length:20},(_,i)=>({...card(`pack4-${i}`,"new"),createdAt:new Date("2026-11-11")}));
  const first=buildDailyPlan([...pool(110,30,0),...newer,...older.slice().reverse()],now).filter(p=>p.group==="new");
  expect(first.map(p=>p.id).sort()).toEqual(older.slice(0,10).map(c=>c.id));
  // Once those ten have been introduced, the next batch drains the older remainder first.
  const next=buildDailyPlan([...pool(110,30,0),...newer,...older.slice(10)],now).filter(p=>p.group==="new");
  expect(next.map(p=>p.id)).toEqual(expect.arrayContaining(older.slice(10).map(c=>c.id)));
  expect(next.filter(p=>p.id.startsWith("pack4-")).length).toBe(8);
 });
 it("uses legacy confidence without pretending both directions were tested",()=>{
  const c=card("old","new");c.reviews=[{quality:4,reviewedAt:new Date(0)}];
  expect(isSecureBothWays(c)).toBe(false);
  expect(counts(buildDailyPlan([c],now))).toEqual([1,0,0]);
  expect([0,1,2,3,4,5].map(recallBand)).toEqual(["unrated","dont-know","kind-of","secure","secure","secure"]);
 });
 it("keeps Kind of in practice with a one-day retry, even after a long interval",()=>{
  const next=scheduleDirection(2,state("front"),now);
  expect(next).toMatchObject({interval:1,repetitions:0,nextReviewAt:future});
  const c=card("a","secure");c.recallStates[0].lastQuality=2;expect(isSecureBothWays(c)).toBe(false);
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
