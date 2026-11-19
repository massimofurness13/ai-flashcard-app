import {describe,it,expect} from 'vitest';
import {patchSavedStudy} from '../../mobile/study-edits';
import type {StudyResumeSnapshot,StudyResumeCard} from '@/lib/study-resume';
const card=(id:string):StudyResumeCard=>({id,front:id,back:id,deck:{id:'d',name:'Pack',emoji:null},hint:null,imageUrl:null,imageTier:null});
const snapshot=():StudyResumeSnapshot=>({cards:['a','b','a','c'].map(card),currentIndex:3,stats:{cardsReviewed:3,ratings:{4:3}},isFlipped:false,learningLanguage:'es',savedAt:100,undoHistory:[{index:1,review:{eventId:'e',cardId:'b',quality:4,reviewedAt:new Date().toISOString()}},{index:2,review:{eventId:'f',cardId:'a',quality:4,reviewedAt:new Date().toISOString()}}]});
describe('offline session edits',()=>{
 it('removes all repeat occurrences and preserves the current logical card, review tally and undo indices',()=>{
  const result=patchSavedStudy(snapshot(),{kind:'card:delete',id:'a',base:{}}) as StudyResumeSnapshot;
  expect(result.cards.map(c=>c.id)).toEqual(['b','c']);expect(result.currentIndex).toBe(1);expect(result.stats.cardsReviewed).toBe(3);expect(result.undoHistory).toHaveLength(1);expect(result.undoHistory![0].index).toBe(0);
 });
 it('patches every copy of an edited card without resetting the cursor',()=>{
  const result=patchSavedStudy(snapshot(),{kind:'card:update',id:'a',fields:{front:'corrected'},base:{front:'a'}}) as StudyResumeSnapshot;
  expect(result.currentIndex).toBe(3);expect(result.cards.filter(c=>c.id==='a').every(c=>c.front==='corrected')).toBe(true);
 });
 it('removes archived packs from unfinished sessions',()=>{
  const result=patchSavedStudy(snapshot(),{kind:'deck:update',id:'d',fields:{archive:true},base:{archive:false}}) as StudyResumeSnapshot;
  expect(result.cards).toEqual([]);expect(result.currentIndex).toBe(0);expect(result.stats.cardsReviewed).toBe(3);
 });
});
