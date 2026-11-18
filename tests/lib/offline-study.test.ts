import "fake-indexeddb/auto";
import {beforeEach, describe, expect, it, vi} from "vitest";
vi.mock("@/lib/device-media", () => ({deviceOwner: vi.fn(), audioKey: vi.fn(), downloadMedia: vi.fn(), resolveSavedAudio: vi.fn()}));
import {saveStudy, readOfflineStudy, studyKey, checkpointKey, type SavedStudy} from "@/lib/offline-study";
import {writeRecord, listRecords} from "@/lib/device-db";
import {queueReview, queueUndo, flushReviews} from "@/lib/review-outbox";
import {deviceOwner} from "@/lib/device-media";
const daily = {day:"2026-11-18",timingKey:"plan1",completed:0,total:2,ratings:{},mix:{practice:1,retention:1,new:0}};
const data: SavedStudy = {cards:[{id:"c1",front:"hola",back:"hello",imageUrl:null,imageTier:null,hint:null,deck:{id:"d",name:"Spanish",emoji:null}}],learningLanguage:"es",daily};
let owner: string;
beforeEach(()=>{owner=crypto.randomUUID();vi.mocked(deviceOwner).mockResolvedValue(owner);vi.stubGlobal("window",{dispatchEvent:vi.fn()});vi.stubGlobal("navigator",{onLine:false});vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));});
describe("offline study",()=>{
 it("shares daily selection across timers but separates custom selections",()=>{
   expect(studyKey(new URLSearchParams("filter=daily&autoFlip=1"))).toBe("study:daily");
   expect(studyKey(new URLSearchParams("filter=random&deckIds=a"))).not.toBe(studyKey(new URLSearchParams("filter=random&deckIds=b")));
 });
 it("never exposes another account's session",async()=>{
   await saveStudy(owner,"study:daily",data);
   expect(await readOfflineStudy("other","study:daily")).toBeNull();
 });
 it("restores the exact cursor and grading after an offline rating",async()=>{
   await saveStudy(owner,"study:daily",data);
   const snapshot={cards:data.cards,currentIndex:1,stats:{cardsReviewed:1,ratings:{4:1}},savedAt:Date.now(),dailyDay:daily.day,timingKey:daily.timingKey};
   const review=await queueReview("c1",4,"back",()=>({key:checkpointKey("study:daily"),value:snapshot}));
   expect((await readOfflineStudy(owner,"study:daily"))?.snapshot).toMatchObject(snapshot);
   expect((await listRecords(owner,"review:"))[0].value).toMatchObject({eventId:review.eventId,quality:4});
   expect(fetch).not.toHaveBeenCalled();
   vi.stubGlobal("navigator",{onLine:true});
   vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({recorded:true})}));
   await flushReviews(owner);
   expect(await listRecords(owner,"review:")).toHaveLength(0);
   expect((await readOfflineStudy(owner,"study:daily"))?.snapshot?.currentIndex).toBe(1);
 });
 it("atomically restores position with a queued offline undo",async()=>{
   await saveStudy(owner,"study:daily",data);
   const review=await queueReview("c1",4);
   const snapshot={cards:data.cards,currentIndex:0,stats:{cardsReviewed:0,ratings:{}},savedAt:Date.now(),dailyDay:daily.day,timingKey:daily.timingKey};
   await queueUndo(review,()=>({key:checkpointKey("study:daily"),value:snapshot}));
   expect((await readOfflineStudy(owner,"study:daily"))?.snapshot?.currentIndex).toBe(0);
   expect(await listRecords(owner,"review:")).toHaveLength(2);
 });
 it("does not mix yesterday's checkpoint with today's plan",async()=>{
   await saveStudy(owner,"study:daily",data);
   await writeRecord(owner,checkpointKey("study:daily"),{dailyDay:"2026-11-17",timingKey:"old",currentIndex:100});
   expect((await readOfflineStudy(owner,"study:daily"))?.snapshot).toBeNull();
 });
 it("does not store a review if its checkpoint cannot be cloned",async()=>{
   await expect(queueReview("c1",4,"front",()=>({key:"checkpoint",value:()=>{}}))).rejects.toThrow();
   // Synchronous put failure must abort the entire transaction.
   await new Promise(resolve=>setTimeout(resolve,5));
   expect(await listRecords(owner,"review:")).toHaveLength(0);
 });
});
