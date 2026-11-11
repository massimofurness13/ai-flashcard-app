import {describe,it,expect,vi,beforeEach} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),find:vi.fn(),update:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireAuth:m.auth}));
vi.mock("@/lib/db",()=>({prisma:{deck:{findUnique:m.find,update:m.update}}}));
vi.mock("next/cache",()=>({revalidatePath:m.revalidate}));
import {PATCH} from "@/app/api/decks/[deckId]/route";
const req=(body:unknown)=>new Request("https://huella.example/api/decks/pack",{method:"PATCH",body:JSON.stringify(body)});
const context={params:Promise.resolve({deckId:"pack"})};
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({userId:"owner"});m.find.mockResolvedValue({id:"pack"});m.update.mockResolvedValue({id:"pack"});});
describe("pack archive API",()=>{
 it.each([true,false])("changes only archive status for archive=%s",async archive=>{
  expect((await PATCH(req({archive}),context)).status).toBe(200);
  expect(m.find).toHaveBeenCalledWith({where:{id:"pack",userId:"owner"},select:{id:true}});
  expect(m.update.mock.calls[0][0].data).toEqual({archivedAt:archive?expect.any(Date):null});
  expect(m.revalidate).toHaveBeenCalledWith("/archive");
 });
 it("rejects packs belonging to someone else",async()=>{
  m.find.mockResolvedValue(null);expect((await PATCH(req({archive:true}),context)).status).toBe(404);expect(m.update).not.toHaveBeenCalled();
 });
 it.each([null,[],{archive:"false"},{archive:1}])("rejects invalid updates",async body=>{
  expect((await PATCH(req(body),context)).status).toBe(400);expect(m.update).not.toHaveBeenCalled();
 });
});
