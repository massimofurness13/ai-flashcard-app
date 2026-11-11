import {describe,it,expect,vi,afterEach} from "vitest";
import {setPackArchived} from "@/lib/archive-pack";
afterEach(()=>vi.unstubAllGlobals());
describe("archive acknowledgement",()=>{
 it.each([true,false])("confirms archive=%s without deleting cards",async archive=>{
  const send=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:"pack",archivedAt:archive?new Date().toISOString():null})});vi.stubGlobal("fetch",send);
  await setPackArchived("pack",archive);
  expect(send.mock.calls[0][1].method).toBe("PATCH");expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({archive});
 });
 it.each([{ok:false,json:async()=>({})},{ok:true,json:async()=>({})},{ok:true,json:async()=>{throw Error("sign-in page");}},{ok:true,json:async()=>({id:"wrong",archivedAt:"now"})}])("does not treat an unsuccessful or unrelated response as archived",async response=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(response));await expect(setPackArchived("pack",true)).rejects.toThrow("Couldn't archive");
 });
});
