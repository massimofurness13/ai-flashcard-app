import {beforeEach,describe,it,expect,vi} from "vitest";
const mock=vi.hoisted(()=>({auth:vi.fn(),transaction:vi.fn(),receipt:vi.fn(),save:vi.fn(),card:vi.fn(),update:vi.fn(),remove:vi.fn(),folder:vi.fn(),deck:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireAuth:mock.auth}));
vi.mock("@/lib/db",()=>({prisma:{$transaction:mock.transaction,deviceMutation:{findUnique:mock.receipt}}}));
import {POST} from "@/app/api/offline/mutations/route";
const input={eventId:"33333333-3333-4333-8333-333333333333",operation:{kind:"card:update",id:"c",fields:{front:"hola"},base:{front:"hello"}}};
const request=(body:unknown)=>new Request("https://example.invalid/api/offline/mutations",{method:"POST",body:JSON.stringify(body)});
beforeEach(()=>{
 vi.clearAllMocks();mock.auth.mockResolvedValue({userId:"owner"});mock.receipt.mockResolvedValue(null);mock.save.mockResolvedValue({});mock.card.mockResolvedValue({id:"c",front:"hello",deck:{userId:"owner"}});mock.update.mockResolvedValue({id:"c",front:"hola"});mock.folder.mockResolvedValue(null);
 mock.transaction.mockImplementation(fn=>fn({deviceMutation:{findUnique:mock.receipt,create:mock.save},card:{findUnique:mock.card,update:mock.update,delete:mock.remove},folder:{findFirst:mock.folder},deck:{findFirst:mock.deck}}));
});
describe("native mutation receipts",()=>{
 it("authenticates before touching data",async()=>{mock.auth.mockResolvedValue({error:Response.json({error:"Unauthorized"},{status:401})});expect((await POST(request(input))).status).toBe(401);expect(mock.transaction).not.toHaveBeenCalled();});
 it("commits a receipt with the edit",async()=>{const response=await POST(request(input));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({recorded:true,result:{front:"hola"}});expect(mock.update).toHaveBeenCalledTimes(1);expect(mock.save).toHaveBeenCalledTimes(1);expect(mock.transaction.mock.calls[0][1]).toEqual({isolationLevel:"Serializable"});});
 it("returns the original acknowledgement on a retry",async()=>{await POST(request(input));const receipt=mock.save.mock.calls[0][0].data;mock.receipt.mockResolvedValue(receipt);mock.update.mockClear();expect((await POST(request(input))).status).toBe(200);expect(mock.update).not.toHaveBeenCalled();});
 it("rejects reusing an event with different content",async()=>{await POST(request(input));mock.receipt.mockResolvedValue(mock.save.mock.calls[0][0].data);mock.update.mockClear();expect((await POST(request({...input,operation:{...input.operation,fields:{front:"different"}}}))).status).toBe(409);expect(mock.update).not.toHaveBeenCalled();});
 it("does not modify another account's card",async()=>{mock.card.mockResolvedValue({id:"c",front:"hello",deck:{userId:"other"}});expect((await POST(request(input))).status).toBe(404);expect(mock.update).not.toHaveBeenCalled();expect(mock.save).not.toHaveBeenCalled();});
 it("retains a conflict instead of overwriting another device",async()=>{mock.card.mockResolvedValue({id:"c",front:"changed elsewhere",deck:{userId:"owner"}});expect((await POST(request(input))).status).toBe(409);expect(mock.update).not.toHaveBeenCalled();});
 it("never acknowledges a failed transaction",async()=>{mock.transaction.mockRejectedValue(Error("database unavailable"));expect((await POST(request(input))).status).toBe(503);});
 it("rejects malformed JSON",async()=>{expect((await POST(new Request("https://example.invalid",{method:"POST",body:"{"}))).status).toBe(400);});
});
