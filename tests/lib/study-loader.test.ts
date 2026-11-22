import 'fake-indexeddb/auto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/device-media',()=>({deviceOwner:vi.fn()}));
import {deviceOwner} from '@/lib/device-media';
import {readRecord,writeRecord} from '@/lib/device-db';
import {loadStudySession,studyLoadError} from '@/lib/study-loader';
import type {SavedStudy} from '@/lib/offline-study';
const now=new Date('2026-11-22T14:00:00Z');
const params=new URLSearchParams('filter=daily&limit=120&orientation=auto');
let owner:string;
const cards=Array.from({length:120},(_,i)=>({id:`card-${i}`,front:`Español ${i}`,back:`English ${i}`,deck:{id:'pack',name:'Pack',emoji:null},hint:null,tags:null,imageUrl:null,imageTier:null,createdAt:'2026-01-01',nextReviewAt:'2026-01-01',easeFactor:2.5,interval:0,repetitions:0,recallStates:[],reviews:[{quality:i<50?4:1,reviewedAt:'2026-11-20T12:00:00Z'}]}));
const daily=():SavedStudy=>({cards,learningLanguage:'es',daily:{day:'2026-11-22',timingKey:'today',completed:0,total:120,ratings:{},mix:{retention:50,practice:70,new:0}}});
beforeEach(async()=>{
 owner=crypto.randomUUID();vi.mocked(deviceOwner).mockResolvedValue(owner);
 vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('window',{dispatchEvent:vi.fn()});vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
 await writeRecord(owner,'library:manifest',{deckIds:['pack'],timeZone:'UTC',learningLanguage:'es',syncedAt:Date.now()});
 await writeRecord(owner,'query:/api/decks/pack/view',{deck:{id:'pack',name:'Pack',emoji:null,cards:structuredClone(cards)},learningLanguage:'es'});
});
afterEach(()=>vi.useRealTimers());
it('opens an unsaved daily 120 entirely offline with correct learning/retention history',async()=>{
 const loaded=await loadStudySession(owner,params,{now});
 expect(loaded.data.cards).toHaveLength(120);expect(loaded.data.daily?.mix).toEqual({practice:70,retention:50,new:0});
 expect(fetch).not.toHaveBeenCalled();expect(await readRecord(owner,'plan:2026-11-22')).toBeDefined();
});
it('reopens today immediately offline without trying to repair old incomplete pack documents',async()=>{
 await writeRecord(owner,'study:daily',daily());
 await writeRecord(owner,'query:/api/decks/pack/view',{deck:{id:'pack',cards:[{id:'legacy'}]}});
 const loaded=await loadStudySession(owner,params,{now});expect(loaded.data.cards).toHaveLength(120);expect(fetch).not.toHaveBeenCalled();
});
it('preserves a 51/120 checkpoint and pending review when reopening offline',async()=>{
 await writeRecord(owner,'study:daily',daily());
 const checkpoint={cards,currentIndex:51,dailyDay:'2026-11-22',timingKey:'today',stats:{cardsReviewed:51,ratings:{4:51}},savedAt:Date.now()};
 await writeRecord(owner,'checkpoint:study:daily',checkpoint);
 await writeRecord(owner,'review:pending',{eventId:'pending',cardId:'card-50',quality:4});
 const loaded=await loadStudySession(owner,params,{now});expect(loaded.snapshot).toMatchObject(checkpoint);
 expect((await readRecord(owner,'review:pending'))?.value).toMatchObject({quality:4});expect(fetch).not.toHaveBeenCalled();
});
it('uses one canonical server selection when old pack history is missing, never a per-pack download',async()=>{
 await writeRecord(owner,'query:/api/decks/pack/view',{deck:{id:'pack',cards:[{id:'legacy'}]}});
 vi.stubGlobal('navigator',{onLine:true});vi.mocked(fetch).mockResolvedValue(Response.json(daily()));
 const loaded=await loadStudySession(owner,params,{now});expect(loaded.data.cards).toHaveLength(120);
 expect(fetch).toHaveBeenCalledTimes(1);expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/review?'+params);
 expect((await readRecord(owner,'study:daily'))?.value).toMatchObject({daily:{total:120}});
});
it('does not relabel unknown old history as new vocabulary when offline',async()=>{
 await writeRecord(owner,'query:/api/decks/pack/view',{deck:{id:'pack',cards:[{id:'legacy'}]}});
 await expect(loadStudySession(owner,params,{now})).rejects.toThrow('learning history');
 expect(fetch).not.toHaveBeenCalled();expect(await readRecord(owner,'study:daily')).toBeUndefined();
});
it('times out a stalled request, ignores its late result, and allows a clean retry',async()=>{
 await writeRecord(owner,'query:/api/decks/pack/view',{deck:{id:'pack',cards:[{id:'legacy'}]}});
 vi.stubGlobal('navigator',{onLine:true});let finish!:(r:Response)=>void;
 vi.mocked(fetch).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const request=loadStudySession(owner,params,{now,timeoutMs:50});await expect(request).rejects.toThrow('Refresh timed out');
 finish(Response.json(daily()));await new Promise(r=>setTimeout(r,10));expect(await readRecord(owner,'study:daily')).toBeUndefined();
 vi.mocked(fetch).mockResolvedValue(Response.json(daily()));expect((await loadStudySession(owner,params,{now})).data.cards).toHaveLength(120);
});
it('does not store a server response into an account that was signed out while loading',async()=>{
 await writeRecord(owner,'query:/api/decks/pack/view',{deck:{id:'pack',cards:[{id:'legacy'}]}});
 vi.stubGlobal('navigator',{onLine:true});vi.mocked(fetch).mockImplementation(async()=>{vi.mocked(deviceOwner).mockResolvedValue('other');return Response.json(daily());});
 await expect(loadStudySession(owner,params,{now})).rejects.toThrow('account changed');expect(await readRecord(owner,'study:daily')).toBeUndefined();
});
it('replaces raw cancellation errors with a useful retry message',()=>{
 expect(studyLoadError(new DOMException('Cancelled','AbortError'))).toContain('try again');
 expect(studyLoadError(new Error('Refresh timed out'))).not.toBe('Refresh timed out');
});
