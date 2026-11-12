import { describe,it,expect } from "vitest";
import { evaluateFsrsTrial,trialRating,type TrialReview } from "@/lib/fsrs-trial";
import { Rating } from "ts-fsrs";
const r=(id:string,day:number,quality=4,direction:string|null="front",cardId="card"):TrialReview=>({id,cardId,direction,quality,interval:6,reviewedAt:new Date(day*86400000)});
describe("read-only FSRS shadow comparison",()=>{
 it("maps partial recall conservatively, preserving historical Easy",()=>{
  expect([1,2,3,4,5].map(trialRating)).toEqual([Rating.Again,Rating.Again,Rating.Good,Rating.Good,Rating.Easy]);
 });
 it("does not score first exposures, same-day repetitions or passive views",()=>{
  const report=evaluateFsrsTrial([r("a",0),r("b",0.5),r("c",1,0),r("d",2)]);
  expect(report.reviewsReplayed).toBe(3);expect(report.comparisons).toBe(1);
  expect(report.fsrsBrier).toBeGreaterThanOrEqual(0);expect(report.fsrsBrier).toBeLessThanOrEqual(1);
 });
 it("keeps directions separate and never assigns unknown historical faces",()=>{
  const report=evaluateFsrsTrial([r("a",0),r("b",2,4,"back"),r("c",3,4,null)]);
  expect(report.directions).toBe(2);expect(report.comparisons).toBe(0);expect(report.unknownDirection).toBe(1);
  expect(report.fsrsBrier).toBeNull();
 });
 it("predicts before applying the current answer, without leaking its outcome",()=>{
  const recalled=evaluateFsrsTrial([r("a",0),r("b",7,4)]);
  const forgotten=evaluateFsrsTrial([r("a",0),r("b",7,1)]);
  // For the same prediction p: sqrt((p-1)^2) + sqrt(p^2) = 1.
  expect(Math.sqrt(recalled.fsrsBrier!)+Math.sqrt(forgotten.fsrsBrier!)).toBeCloseTo(1,10);
  expect(recalled.recalls).toBe(1);expect(forgotten.recalls).toBe(0);
 });
 it("is deterministic, ignores duplicate event IDs, and does not mutate input",()=>{
  const input=[r("b",7),r("a",0),r("a",0)];const original=JSON.stringify(input);
  const first=evaluateFsrsTrial(input,true);
  expect(evaluateFsrsTrial(input,true)).toEqual(first);expect(first.comparisons).toBe(1);
  expect(first.truncated).toBe(true);expect(JSON.stringify(input)).toBe(original);
 });
 it("does not present a zero baseline interval as a measurable prediction",()=>{
  expect(evaluateFsrsTrial([{...r("a",0),interval:0},r("b",2)]).comparisons).toBe(0);
 });
});
