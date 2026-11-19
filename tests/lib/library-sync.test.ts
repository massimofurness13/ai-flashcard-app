import "fake-indexeddb/auto";
import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({owner:vi.fn(),download:vi.fn(),ready:vi.fn(),flush:vi.fn()}));
vi.mock("@/lib/device-media",()=>({deviceOwner:m.owner}));
vi.mock("@/lib/offline-cache",()=>({downloadPack:m.download,isPackDownloaded:m.ready}));
vi.mock("@/lib/review-outbox",()=>({flushReviews:m.flush}));
import {syncLibrary} from "@/lib/library-sync";
import {readRecord} from "@/lib/device-db";
let owner:string;
beforeEach(()=>{
 vi.clearAllMocks();owner=crypto.randomUUID();m.owner.mockResolvedValue(owner);m.ready.mockResolvedValue(false);m.download.mockResolvedValue({mediaCount:1});m.flush.mockResolvedValue(undefined);
 vi.stubGlobal("navigator",{onLine:true});vi.stubGlobal("window",{dispatchEvent:vi.fn()});
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>({ok:true,json:async()=>url==="/api/study-config"?{decks:[{id:"one"},{id:"two"}]}:url==="/api/library"?{reviewTimeZone:"America/Bogota"}:url.includes("/view")?{deck:{id:url.split("/")[3],cards:[{front:"hola",back:"hello",imageUrl:null}],frontLanguageCode:"es-MX",backLanguageCode:"en-GB"},learningLanguage:"es"}:url.startsWith("/api/review")?{cards:[],learningLanguage:"es",daily:{day:"2026-11-19",total:0,completed:0}}:{}})));
});
describe("automatic whole-library sync",()=>{
 it("saves every pack and statistics before downloading media, not just daily cards",async()=>{
  m.download.mockImplementation(async()=>{expect((await readRecord(owner,"query:/api/decks/two/view"))?.value).toBeTruthy();return {mediaCount:1};});
  expect(await syncLibrary(owner,vi.fn())).toMatchObject({phase:"ready",packs:2,total:2});
  expect(m.download.mock.calls.map(c=>c[0].deckId)).toEqual(["one","two"]);
  expect((await readRecord(owner,"library:manifest"))?.value).toMatchObject({deckIds:["one","two"],timeZone:"America/Bogota"});
  expect(await readRecord(owner,"query:/api/stats?period=30")).toBeTruthy();
 });
 it("a failed pack does not prevent other packs being saved or falsely report readiness",async()=>{
  m.download.mockRejectedValueOnce(new Error("file unavailable"));
  expect(await syncLibrary(owner,vi.fn())).toMatchObject({phase:"paused",packs:1,total:2,failures:1});
  expect(m.download).toHaveBeenCalledTimes(2);
 });
 it("does not redownload already-complete media",async()=>{
  m.ready.mockResolvedValue(true);await syncLibrary(owner,vi.fn());expect(m.download).not.toHaveBeenCalled();
 });
 it("stops on sign-out instead of downloading into the wrong account",async()=>{
  m.owner.mockResolvedValue("other");await expect(syncLibrary(owner,vi.fn())).rejects.toThrow("paused");expect(fetch).not.toHaveBeenCalled();expect(await readRecord(owner,"library:manifest")).toBeUndefined();
 });
});
