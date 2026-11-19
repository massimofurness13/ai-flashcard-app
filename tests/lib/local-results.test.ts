import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {writeRecords} from '@/lib/device-db';
import {localDailyResults} from '@/lib/local-results';
describe('offline finishing results',()=>{
 it('counts actual ratings once and reverses an undo, without network or completion writes',async()=>{
  const owner=crypto.randomUUID(),eventId=crypto.randomUUID(),day='2026-11-19';
  const event={eventId,cardId:'a',quality:4,direction:'front',reviewedAt:day+'T12:00:00Z',sequence:1};
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${owner}:${eventId}`));
  const id=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
  await writeRecords(owner,[{key:'study:daily',value:{cards:[],daily:{day,picks:[{id:'a',studyDirection:'front',group:'practice'}],resultContext:{startedAt:day+'T10:00:00Z',before:[{id:'a',reviews:[]}],logs:[{...event,id}]}}}},{key:'local-review:'+eventId,value:event}]);
  expect(await localDailyResults(owner,day)).toMatchObject({completed:1,total:1,promoted:1});
  await writeRecords(owner,[{key:'local-review:undo:'+eventId,value:{...event,operation:'undo',sequence:2}}]);
  expect(await localDailyResults(owner,day)).toMatchObject({completed:0,promoted:0});
  expect(await localDailyResults(owner,'2026-11-20')).toBeNull();
 });
});
