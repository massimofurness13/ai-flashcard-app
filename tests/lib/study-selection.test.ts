import { describe, expect, it } from "vitest";
import { fillRandomSession, scheduleDirection, selectStudyCards, type RecallState, type StudyCandidate } from "@/lib/study-selection";
const now = new Date("2026-11-11T12:00:00Z");
const yesterday = new Date(now.getTime()-86400000);
const tomorrow = new Date(now.getTime()+86400000);
const state = (direction: string, quality=4, nextReviewAt=tomorrow): RecallState => ({direction,lastQuality:quality,lastReviewedAt:yesterday,nextReviewAt,easeFactor:2.5,interval:6,repetitions:2});
const card = (id: string, recallStates: RecallState[]=[]): StudyCandidate => ({id,front:id,tags:null,createdAt:yesterday,nextReviewAt:yesterday,easeFactor:2.5,interval:0,repetitions:0,recallStates,reviews:[]});
describe("direction-aware study",()=>{
  it("moves a known card to retention and tests its other direction there",()=>{
    expect(selectStudyCards([card("a",[state("front")])],"mastery","auto",now)).toEqual([]);
    expect(selectStudyCards([card("a",[state("front")])],"random","auto",now)[0].studyDirection).toBe("back");
  });
  it("excludes cards known both ways from practice, but recalls them when overdue",()=>{
    const a=card("a",[state("front",4,yesterday),state("back")]);
    expect(selectStudyCards([a],"mastery","auto",now)).toEqual([]);
    expect(selectStudyCards([a],"due","auto",now)[0].studyDirection).toBe("front");
  });
  it("does not show future successful directions in spaced review",()=>{
    expect(selectStudyCards([card("a",[state("front"),state("back")])],"due","auto",now)).toEqual([]);
  });
  it("prioritises failed cards and preserves stable practice pagination",()=>{
    const cards=[card("a"),card("b",[state("back",1,yesterday)])];
    expect(selectStudyCards(cards,"mastery","auto",now,()=>0.9).map(c=>c.id)).toEqual(["b","a"]);
    expect(selectStudyCards([card("b"),card("a")],"mastery","auto",now,()=>Math.random()).map(c=>c.id)).toEqual(["a","b"]);
  });
  it("honours a manually selected side",()=>{
    expect(selectStudyCards([card("a",[state("front")])],"mastery","front",now)).toEqual([]);
  });
  it("honours old known ratings without requiring both directions to be re-proved",()=>{
    const a=card("a"); a.reviews=[{quality:4,reviewedAt:yesterday}];
    expect(selectStudyCards([a],"mastery","auto",now)).toHaveLength(0);
  });
  it("random covers every unique card before repeating and avoids boundary repeats",()=>{
    const picks=selectStudyCards(Array.from({length:100},(_,i)=>card(String(i))),"random","auto",now);
    const result=fillRandomSession(picks,125,()=>0.5);
    expect(result).toHaveLength(125);
    expect(new Set(result.slice(0,100).map(c=>c.id)).size).toBe(100);
    expect(new Set(result.slice(100).map(c=>c.id)).size).toBe(25);
    expect(result[99].id).not.toBe(result[100].id);
    expect(fillRandomSession([],125)).toEqual([]);
  });
  it("reserves new-card slots alongside overdue reviews",()=>{
    const cards=[...Array.from({length:6},(_,i)=>card(String(i),[state("front",4,yesterday),state("back")])),card("new")];
    expect(selectStudyCards(cards,"due","auto",now)[3].id).toBe("new");
  });
});
describe("directional scheduling",()=>{
  it("retries a failure after ten minutes",()=>{
    expect(scheduleDirection(1,state("front"),now).nextReviewAt.getTime()-now.getTime()).toBe(600000);
  });
  it("does not inflate successful intervals by drilling before due",()=>{
    expect(scheduleDirection(4,state("front"),now)).toMatchObject({interval:6,repetitions:2,nextReviewAt:tomorrow});
  });
  it("extends a successful overdue direction and starts new directions independently",()=>{
    expect(scheduleDirection(4,state("front",4,yesterday),now).interval).toBe(15);
    expect(scheduleDirection(4,null,now)).toMatchObject({interval:1,repetitions:1,nextReviewAt:tomorrow});
  });
});
