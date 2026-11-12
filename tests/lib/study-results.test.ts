import { describe,it,expect } from "vitest";
import { dailyResults, type ResultLog } from "@/lib/study-results";
import type { DailyPick } from "@/lib/daily-study";
const date=(n:number)=>new Date(n*86400000);
const pick=(id:string):DailyPick=>({id,studyDirection:"front",studyReason:"",group:"practice"});
const history=(id:string,grades:number[])=>({id,reviews:grades.map((quality,i)=>({quality,reviewedAt:date(-i-1)}))});
const log=(cardId:string,quality:number,n=1,direction="front"):ResultLog=>({cardId,quality,reviewedAt:date(n),direction});
describe("daily outcomes from real saved grades",()=>{
 it("counts promotions and lapses from history rather than old plan group labels",()=>{
  const result=dailyResults([pick("new"),pick("known"),pick("retained")],[history("new",[]),history("known",[4]),history("retained",[3])],[log("new",4),log("known",1),log("retained",4)]);
  expect(result).toEqual({completed:3,total:3,promoted:1,returnedToLearning:1,retentionSecure:1,retentionReviewed:2});
 });
 it("one Kind of stays in retention but a second returns to learning",()=>{
  expect(dailyResults([pick("a")],[history("a",[4])],[log("a",2)]).returnedToLearning).toBe(0);
  expect(dailyResults([pick("a")],[history("a",[2,4])],[log("a",2)]).returnedToLearning).toBe(1);
 });
 it("does not double count retries, passive views, other cards or wrong-side reviews",()=>{
  const results=dailyResults([pick("a"),pick("b"),pick("c")],[history("a",[4]),history("b",[4]),history("c",[4])],[log("a",1),log("a",4,2),log("b",0),log("c",4,1,"back"),log("other",1)]);
  expect(results).toEqual({completed:1,total:3,promoted:0,returnedToLearning:0,retentionSecure:1,retentionReviewed:1});
 });
 it("never calls an already-known card a new promotion",()=>{
  expect(dailyResults([pick("a")],[history("a",[5])],[log("a",4)]).promoted).toBe(0);
 });
});
