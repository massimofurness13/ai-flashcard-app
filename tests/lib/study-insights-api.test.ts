import { beforeEach,describe,it,expect,vi } from "vitest";
import { NextRequest } from "next/server";
const m=vi.hoisted(()=>({auth:vi.fn(),cards:vi.fn(),logs:vi.fn(),plan:vi.fn(),next:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireAuth:m.auth}));
vi.mock("@/lib/db",()=>({prisma:{card:{findMany:m.cards},reviewLog:{findMany:m.logs},dailyStudyPlan:{findUnique:m.plan,findFirst:m.next}}}));
import { GET as results } from "@/app/api/study-results/route";
import { GET as trial } from "@/app/api/study-trial/route";
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({userId:"owner"});});
describe("study insight endpoints",()=>{
 it("requires authentication before reading either report",async()=>{
  m.auth.mockResolvedValue({error:new Response(null,{status:401})});
  expect((await trial()).status).toBe(401);expect((await results(new NextRequest("https://huella.example/api/study-results?day=2026-11-12"))).status).toBe(401);
  expect(m.logs).not.toHaveBeenCalled();expect(m.plan).not.toHaveBeenCalled();
 });
 it("does not create a missing set or accept an invalid day",async()=>{
  expect((await results(new NextRequest("https://huella.example/api/study-results?day=bad"))).status).toBe(400);
  m.plan.mockResolvedValue(null);
  expect((await results(new NextRequest("https://huella.example/api/study-results?day=2026-11-12"))).status).toBe(404);
  expect(m.cards).not.toHaveBeenCalled();
 });
 it("uses owner-scoped actual history and excludes deleted or archived cards",async()=>{
  const start=new Date("2026-11-12T12:00Z"),end=new Date("2026-11-13T12:00Z");
  m.plan.mockResolvedValue({createdAt:start,picks:[{id:"a",studyDirection:"front",group:"practice"},{id:"deleted",studyDirection:"front",group:"practice"}]});
  m.cards.mockResolvedValue([{id:"a",reviews:[]}]);m.next.mockResolvedValue({createdAt:end});
  m.logs.mockResolvedValue([{cardId:"a",direction:"front",quality:4,reviewedAt:new Date("2026-11-12T12:10Z")}]);
  const response=await results(new NextRequest("https://huella.example/api/study-results?day=2026-11-12"));
  expect(await response.json()).toMatchObject({total:1,completed:1,promoted:1});
  expect(m.plan.mock.calls[0][0].where.userId_day.userId).toBe("owner");
  expect(m.cards.mock.calls[0][0].where.deck).toEqual({userId:"owner",archivedAt:null});
  expect(m.logs.mock.calls[0][0].where).toMatchObject({cardId:{in:["a"]},card:{deck:{userId:"owner"}},reviewedAt:{gte:start,lt:end}});
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
 });
 it("limits trial work, excludes passive/future reviews and scopes to the signed-in owner",async()=>{
  m.logs.mockResolvedValue([]);const response=await trial();
  expect(await response.json()).toMatchObject({mode:"shadow",comparisons:0,fsrsBrier:null});
  expect(m.logs.mock.calls[0][0]).toMatchObject({take:20001,where:{card:{deck:{userId:"owner",archivedAt:null}},quality:{gt:0},reviewedAt:{lte:expect.any(Date)}}});
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
 });
});
