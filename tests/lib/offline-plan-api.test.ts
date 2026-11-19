import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),user:vi.fn(),cards:vi.fn(),plan:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireAuth:m.auth}));
vi.mock("@/lib/db",()=>({prisma:{user:{findUnique:m.user},card:{findMany:m.cards},dailyStudyPlan:{upsert:m.plan}}}));
import {POST} from "@/app/api/offline/plans/route";
const pick={id:"c",studyDirection:"front",studyReason:"Needs practice",group:"practice"};
const body=()=>({day:new Date().toISOString().slice(0,10),createdAt:new Date().toISOString(),picks:[pick]});
const req=(v:unknown)=>new Request("https://test/api/offline/plans",{method:"POST",body:JSON.stringify(v)}) as Parameters<typeof POST>[0];
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({userId:"owner"});m.user.mockResolvedValue({reminderTimezone:"UTC"});m.cards.mockResolvedValue([{id:"c"}]);m.plan.mockImplementation(({create})=>({...create}));});
describe("offline selection sync",()=>{
 it("saves only a selection; does not create review or completion evidence",async()=>{
  expect(await(await POST(req(body()))).json()).toEqual({recorded:true});
  expect(m.plan.mock.calls[0][0].create).toMatchObject({userId:"owner",picks:[pick]});
  expect(m.cards.mock.calls[0][0].where.deck).toEqual({userId:"owner"});
 });
 it("never replaces a set already created by another device",async()=>{
  m.plan.mockResolvedValue({picks:[{...pick,id:"other"}]});
  expect((await POST(req(body()))).status).toBe(409);
  expect(m.plan.mock.calls[0][0].update).toEqual({});
 });
 it("handles deleted/foreign card identifiers without saving them",async()=>{
  m.cards.mockResolvedValue([]);
  expect((await POST(req(body()))).status).toBe(200);
  expect(m.plan.mock.calls[0][0].create.picks).toEqual([]);
 });
 it("rejects duplicate cards and future dates",async()=>{
  expect((await POST(req({...body(),picks:[pick,pick]}))).status).toBe(400);
  expect((await POST(req({...body(),createdAt:new Date(Date.now()+86400000).toISOString()}))).status).toBe(400);
  expect(m.plan).not.toHaveBeenCalled();
 });
 it("requires authentication",async()=>{
  m.auth.mockResolvedValue({error:new Response(null,{status:401})});expect((await POST(req(body()))).status).toBe(401);expect(m.plan).not.toHaveBeenCalled();
 });
});
