import { describe, it, expect } from "vitest";
import { isRetentionCard, latestRecallQualities } from "@/lib/recall-history";
function history(...qualities:number[]) {
 return {reviews:qualities.map((quality,i)=>({quality,reviewedAt:new Date(10_000-i*1000)})),recallStates:[]};
}
describe("learning and retention transitions",()=>{
 it.each([3,4,5])("honours historical known score %s without manufacturing direction records",q=>{
  const card=history(q);expect(isRetentionCard(card)).toBe(true);expect(card.recallStates).toEqual([]);
 });
 it.each([[2,4],[2,3],[2,5],[4,2],[4,1]])("retains/promotes latest history %j",(...q)=>expect(isRetentionCard(history(...q))).toBe(true));
 it.each([[1,4],[2,2],[2,1],[2],[1],[]])("keeps or returns history %j to learning",(...q)=>expect(isRetentionCard(history(...q))).toBe(false));
 it("ignores passive views between meaningful ratings",()=>{
  expect(isRetentionCard(history(0,2,0,4))).toBe(true);
  expect(isRetentionCard(history(2,0,2,4))).toBe(false);
  expect(latestRecallQualities(history(0,4))).toEqual([4]);
 });
 it("lets newer real feedback override an old directional success",()=>{
  const card={...history(1,4),recallStates:[{lastQuality:4,lastReviewedAt:new Date(0)}]};
  expect(isRetentionCard(card)).toBe(false);
 });
});
