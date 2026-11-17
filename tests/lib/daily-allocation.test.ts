import { describe, expect, it } from "vitest";
import { chooseDailyAllocation, initialDailyAllocation, retentionSamples, storedDailyAllocation, type AllocationLog, type AllocationPlan } from "@/lib/daily-allocation";
import { buildDailyPlan, type DailyPick } from "@/lib/daily-study";

const allocation = initialDailyAllocation();
const pick = (id: string, group: DailyPick["group"] = "retention"): DailyPick => ({id,group,studyDirection:"front",studyReason:""});
const previous = (retentionTarget = 50, assessedThroughDay: string | null = null): DailyPick[] => [{...pick("a"),dailyAllocation:{...allocation,retentionTarget,assessedThroughDay}}];
const samples = (secure: number, reviewed = 50) => ["2026-11-17","2026-11-18","2026-11-19"].map(day => ({day,secure,reviewed}));

describe("adaptive daily allocation", () => {
  it("starts at 70 learning / 50 retention even with excellent legacy results", () => {
    expect(chooseDailyAllocation([pick("legacy")],samples(50))).toEqual(allocation);
  });
  it("waits for three distinct completed sets with enough retention evidence", () => {
    expect(chooseDailyAllocation(previous(),samples(50).slice(0,2)).retentionTarget).toBe(50);
    expect(chooseDailyAllocation(previous(),Array(3).fill(samples(50)[0])).retentionTarget).toBe(50);
    expect(chooseDailyAllocation(previous(),samples(10,10)).retentionTarget).toBe(50);
  });
  it("moves five slots to learning for >=90% secure recall, to retention for <80%, otherwise holds", () => {
    expect(chooseDailyAllocation(previous(),samples(45))).toMatchObject({retentionTarget:45,reason:"strong-recall"});
    expect(chooseDailyAllocation(previous(),samples(39))).toMatchObject({retentionTarget:55,reason:"weak-recall"});
    expect(chooseDailyAllocation(previous(),samples(40))).toMatchObject({retentionTarget:50,reason:"steady"});
    expect(chooseDailyAllocation(previous(),samples(44))).toMatchObject({retentionTarget:50,reason:"steady"});
  });
  it("never goes below 40 retention or above 80, and weights by reviews rather than set size", () => {
    expect(chooseDailyAllocation(previous(40),samples(50)).retentionTarget).toBe(40);
    expect(chooseDailyAllocation(previous(80),samples(0)).retentionTarget).toBe(80);
    expect(chooseDailyAllocation(previous(),[{day:"2026-11-17",secure:0,reviewed:20},{day:"2026-11-18",secure:80,reviewed:80},{day:"2026-11-19",secure:80,reviewed:80}]).retentionTarget).toBe(50);
  });
  it("does not reuse the same evidence on reload or the next day", () => {
    const decision = chooseDailyAllocation(previous(),samples(50));
    const next = [{...pick("a"),dailyAllocation:decision}];
    expect(chooseDailyAllocation(next,samples(50))).toMatchObject({retentionTarget:45,reason:"collecting"});
    expect(decision.assessedThroughDay).toBe("2026-11-19");
    expect(chooseDailyAllocation(next,[...samples(50),{day:"2026-11-20",secure:45,reviewed:45}]).retentionTarget).toBe(45);
  });
  it("keeps the chosen split in stored picks independently of today's actual pool size", () => {
    const cards = Array.from({length:200},(_,i) => ({id:String(i),front:"",tags:null,createdAt:new Date(0),nextReviewAt:new Date(0),easeFactor:2.5,interval:0,repetitions:0,
      reviews:i<100?[{quality:4,reviewedAt:new Date(0)}]:[],recallStates:[]}));
    for (const retentionTarget of [40,45,50,55,80]) {
      const chosen={...allocation,retentionTarget};
      const plan=buildDailyPlan(cards,new Date(),()=>0.5,[],chosen);
      expect(plan).toHaveLength(120);
      expect(plan.filter(p=>p.group==="retention")).toHaveLength(retentionTarget);
      expect(plan.filter(p=>p.group==="new")).toHaveLength(120-retentionTarget);
      expect(new Set(plan.map(p=>p.id)).size).toBe(120);
      expect(storedDailyAllocation(plan)).toEqual(chosen);
    }
  });
});

describe("retention evidence", () => {
  const start=new Date("2026-11-17T10:00:00Z"), now=new Date("2026-11-18T10:00:00Z");
  const plan: AllocationPlan = {day:"2026-11-17",createdAt:start,picks:[...previous(),pick("b"),pick("learning","practice")]};
  const grade=(cardId:string,quality=4,minutes=1,direction:string|null="front"):AllocationLog=>({cardId,direction,quality,reviewedAt:new Date(start.getTime()+minutes*60000)});
  const active=new Set(["a","b","learning"]);
  it("counts only the first selected-face grade, excluding retries and passive/wrong-face events", () => {
    const logs=[grade("a",0,0.1),grade("a",4,0.5,"back"),grade("a",1),grade("a",4,2),grade("b",2),grade("learning")];
    expect(retentionSamples([plan],logs,active,now)).toEqual([{day:plan.day,reviewed:2,secure:0}]);
  });
  it("ignores partial sets, future grades and earlier practice", () => {
    expect(retentionSamples([plan],[grade("a"),grade("b")],active,now)).toEqual([]);
    expect(retentionSamples([plan],[grade("a"),grade("b"),grade("learning",4,-1)],active,now)).toEqual([]);
    expect(retentionSamples([plan],[grade("a"),grade("b"),grade("learning",4,1500)],active,now)).toEqual([]);
  });
  it("accepts genuine completion after deletion while keeping allocation metadata from raw picks", () => {
    expect(retentionSamples([plan],[grade("b"),grade("learning")],new Set(["b","learning"]),now)).toEqual([{day:plan.day,reviewed:1,secure:1}]);
    expect(storedDailyAllocation(plan.picks)).toEqual(allocation);
    expect(retentionSamples([plan],[],new Set(),now)).toEqual([]);
  });
  it("cannot use the next day's grades to complete an earlier set", () => {
    const next={...plan,day:"2026-11-18",createdAt:new Date(start.getTime()+60*60000)};
    expect(retentionSamples([plan,next],[grade("a",4,61),grade("b",4,61),grade("learning",4,61)],active,now)).toEqual([{day:next.day,reviewed:2,secure:2}]);
  });
  it("does not learn from old plans created before adaptive allocation", () => {
    const old={...plan,picks:plan.picks.map(p=>{const copy={...p};delete copy.dailyAllocation;return copy;})};
    expect(retentionSamples([old],[grade("a"),grade("b"),grade("learning")],active,now)).toEqual([]);
  });
});
