import { describe, expect, it } from "vitest";
import { buildDailyPlan } from "@/lib/daily-study";
import { initialDailyAllocation } from "@/lib/daily-allocation";
import { lastCardReviewAt, reviewDueAt, scheduleDirection, selectStudyCards, type StudyCandidate } from "@/lib/study-selection";
import { sm2 } from "@/lib/sm2";
const DAY=86_400_000, now=new Date("2026-11-17T12:00:00Z");
const date=(days:number)=>new Date(now.getTime()+days*DAY);
function secure(id:string, age:number, due:number):StudyCandidate {
  return {id,front:id,tags:null,createdAt:date(-400),easeFactor:2.5,interval:200,repetitions:10,nextReviewAt:date(due),
    reviews:[{quality:4,reviewedAt:date(-age)}],
    recallStates:["front","back"].map(direction=>({direction,lastQuality:4,lastReviewedAt:date(-age),nextReviewAt:date(due),easeFactor:2.5,interval:200,repetitions:10}))};
}
const learning=Array.from({length:100},(_,i)=>({...secure(`new-${i}`,0,0),reviews:[],recallStates:[]}));
describe("60-day review ceiling",()=>{
  it.each([2,3,4,5])("caps newly scheduled intervals for grade %i", quality=>{
    expect(sm2(quality,{easeFactor:2.5,interval:100,repetitions:10}).interval).toBe(60);
  });
  it("makes old long schedules due based on last review, without mutating history",()=>{
    const card=secure("old",61,150);
    expect(reviewDueAt(card,"front")).toEqual(date(-1));
    expect(selectStudyCards([card],"due","auto",now)).toHaveLength(1);
    expect(card.recallStates[0].nextReviewAt).toEqual(date(150));
    expect(scheduleDirection(4,card.recallStates[0],now)).toMatchObject({interval:60,nextReviewAt:date(60)});
  });
  it("caps an early review without pushing its deadline forward",()=>{
    const card=secure("early",30,150);
    expect(scheduleDirection(4,card.recallStates[0],now)).toMatchObject({interval:60,nextReviewAt:date(30),repetitions:10});
    expect(selectStudyCards([card],"due","auto",now)).toHaveLength(0);
  });
  it("also caps legacy cards without directional history",()=>{
    const card=secure("legacy",80,200);card.recallStates=[];
    expect(reviewDueAt(card,"front")).toEqual(date(-20));
  });
});
describe("daily retention coverage",()=>{
  const old=()=>Array.from({length:25},(_,i)=>secure(`old-${i}`,55-i,50));
  const urgent=()=>Array.from({length:80},(_,i)=>secure(`urgent-${i}`,1,-10+i/100));
  it.each([40,50,80])("reserves 20 oldest within %i retention and 120 total",retentionTarget=>{
    const picks=buildDailyPlan([...learning,...urgent(),...old()],now,()=>0.5,[],{...initialDailyAllocation(),retentionTarget});
    const retention=picks.filter(p=>p.group==="retention");
    expect(picks).toHaveLength(120);expect(new Set(picks.map(p=>p.id)).size).toBe(120);
    expect(retention).toHaveLength(retentionTarget);
    expect(retention.filter(p=>p.id.startsWith("old-")).map(p=>p.id).sort()).toEqual(old().slice(0,20).map(c=>c.id).sort());
    expect(retention.filter(p=>p.id.startsWith("urgent-")).map(p=>p.id).sort()).toEqual(urgent().slice(0,retentionTarget-20).map(c=>c.id).sort());
  });
  it("rotates reviewed coverage cards out and keeps a partial recall in the remaining slots",()=>{
    const cards=[...learning,...urgent(),...old()];
    const first=buildDailyPlan(cards,now,()=>0.5);
    for(const pick of first.filter(p=>p.group==="retention")) {
      const card=cards.find(c=>c.id===pick.id)!;
      card.reviews.unshift({quality:4,reviewedAt:now});
      card.recallStates[0].lastReviewedAt=now;
    }
    const partial=secure("partial",0,40);partial.reviews.unshift({quality:2,reviewedAt:now});
    const second=buildDailyPlan([...cards,partial],date(1),()=>0.5,first);
    expect(second.filter(p=>p.group==="retention").map(p=>p.id)).toEqual(expect.arrayContaining([...old().slice(20).map(c=>c.id),"partial"]));
    expect(second.filter(p=>p.group==="retention"&&p.id.startsWith("old-")&&Number(p.id.slice(4))<20)).toHaveLength(0);
  });
  it("counts the latest graded review on either face, ignoring passive views",()=>{
    const card=secure("either-face",50,100);
    card.reviews.push({quality:4,reviewedAt:date(-2)},{quality:0,reviewedAt:now});
    expect(lastCardReviewAt(card)).toEqual(date(-2));
    card.reviews=[];card.recallStates[1].lastReviewedAt=date(-1);
    expect(lastCardReviewAt(card)).toEqual(date(-1));
  });
  it("handles fewer than 20 retention candidates without duplicates",()=>{
    const picks=buildDailyPlan([...learning,...old().slice(0,8)],now);
    expect(picks.filter(p=>p.group==="retention")).toHaveLength(8);
    expect(new Set(picks.map(p=>p.id)).size).toBe(picks.length);
  });
});
