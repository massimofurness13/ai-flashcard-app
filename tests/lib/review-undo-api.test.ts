import {beforeEach,describe,it,expect,vi} from "vitest";
import {createHash} from "node:crypto";
import {scheduleSnapshot,recallSnapshot} from "@/lib/review-undo";
const m=vi.hoisted(()=>({auth:vi.fn(),transaction:vi.fn(),lock:vi.fn(),undo:vi.fn(),undoUpdate:vi.fn(),card:vi.fn(),cardUpdate:vi.fn(),recall:vi.fn(),recallUpdate:vi.fn(),recallDelete:vi.fn(),logDelete:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireAuth:m.auth}));
vi.mock("@/lib/db",()=>({prisma:{$transaction:m.transaction}}));
import {DELETE} from "@/app/api/review/route";
const eventId="ec37c8dd-c353-4f58-b690-ad61d5b5a229";
const body={eventId,cardId:"card"};
const before={easeFactor:2.5,interval:6,repetitions:2,nextReviewAt:new Date("2026-11-01")};
const after={easeFactor:2.5,interval:15,repetitions:3,nextReviewAt:new Date("2026-11-17")};
const recall={...after,direction:"front",lastQuality:4,lastReviewedAt:new Date("2026-11-02")};
const call=(value:unknown=body)=>DELETE(new Request("https://huella.example/api/review",{method:"DELETE",body:JSON.stringify(value)}));
beforeEach(()=>{
 vi.clearAllMocks();m.auth.mockResolvedValue({userId:"owner"});m.lock.mockResolvedValue([{id:"card"}]);
 m.card.mockResolvedValue(after);m.recall.mockResolvedValue(recall);
 m.undo.mockResolvedValue({cardId:"card",undoneAt:null,snapshot:{card:{before:scheduleSnapshot(before),after:scheduleSnapshot(after)},recall:{direction:"front",before:null,after:recallSnapshot(recall)}}});
 m.transaction.mockImplementation(fn=>fn({$queryRaw:m.lock,reviewUndo:{findUnique:m.undo,update:m.undoUpdate},card:{findUniqueOrThrow:m.card,update:m.cardUpdate},cardRecall:{findUnique:m.recall,update:m.recallUpdate,delete:m.recallDelete},reviewLog:{delete:m.logDelete}}));
});
describe("atomic review undo",()=>{
 it("restores the prior schedule, removes newly-created directional mastery and removes the counted review",async()=>{
  expect(await (await call()).json()).toEqual({recorded:true,undone:true});
  expect(m.cardUpdate).toHaveBeenCalledWith({where:{id:"card"},data:before});
  expect(m.recallDelete).toHaveBeenCalledWith({where:{cardId_direction:{cardId:"card",direction:"front"}}});
  const id=createHash("sha256").update("owner:"+eventId).digest("hex");
  expect(m.logDelete).toHaveBeenCalledWith({where:{id}});expect(m.undoUpdate).toHaveBeenCalledTimes(1);
 });
 it("accepts snapshots whose keys were reordered by PostgreSQL JSONB",async()=>{
  const reorder=(o:object)=>Object.fromEntries(Object.entries(o).reverse());
  m.undo.mockResolvedValue({cardId:"card",snapshot:{card:{before:reorder(scheduleSnapshot(before)),after:reorder(scheduleSnapshot(after))},recall:{direction:"front",before:null,after:reorder(recallSnapshot(recall)!)}}});
  expect((await call()).status).toBe(200);expect(m.logDelete).toHaveBeenCalledTimes(1);
 });
 it("restores an existing directional schedule",async()=>{
  const oldRecall={...before,direction:"front",lastQuality:2,lastReviewedAt:new Date("2026-10-31")};
  m.undo.mockResolvedValue({cardId:"card",snapshot:{card:null,recall:{direction:"front",before:recallSnapshot(oldRecall),after:recallSnapshot(recall)}}});
  expect((await call()).status).toBe(200);
  expect(m.recallUpdate.mock.calls[0][0].data).toEqual({...before,lastQuality:2,lastReviewedAt:oldRecall.lastReviewedAt});
  expect(m.cardUpdate).not.toHaveBeenCalled();
 });
 it("acknowledges a repeated undo without deleting or rewinding again",async()=>{
  m.undo.mockResolvedValue({cardId:"card",undoneAt:new Date()});
  expect((await call()).status).toBe(200);expect(m.logDelete).not.toHaveBeenCalled();expect(m.cardUpdate).not.toHaveBeenCalled();
 });
 it("refuses to overwrite newer card or directional results",async()=>{
  m.card.mockResolvedValue({...after,repetitions:4});expect((await call()).status).toBe(409);
  m.card.mockResolvedValue(after);m.recall.mockResolvedValue({...recall,lastQuality:1});expect((await call()).status).toBe(409);
  expect(m.cardUpdate).not.toHaveBeenCalled();expect(m.logDelete).not.toHaveBeenCalled();
 });
 it("cannot undo another owner's review",async()=>{
  m.lock.mockResolvedValue([]);expect((await call()).status).toBe(404);expect(m.undo).not.toHaveBeenCalled();
 });
 it("requires a matching saved snapshot",async()=>{
  m.undo.mockResolvedValue(null);expect((await call()).status).toBe(409);
  m.undo.mockResolvedValue({cardId:"another"});expect((await call()).status).toBe(409);expect(m.logDelete).not.toHaveBeenCalled();
 });
 it("rejects invalid event identifiers",async()=>{expect((await call({...body,eventId:"bad"})).status).toBe(400);expect(m.transaction).not.toHaveBeenCalled();});
});
