import 'fake-indexeddb/auto';
import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({owner:vi.fn(),download:vi.fn()}));
vi.mock('@/lib/device-media',()=>({deviceOwner:m.owner,downloadMedia:m.download}));
import {writeRecord} from '@/lib/device-db';
import {syncSavedArtwork} from '@/lib/artwork-sync';
let owner:string;
beforeEach(async()=>{
 owner=crypto.randomUUID();m.owner.mockResolvedValue(owner);m.download.mockReset().mockResolvedValue('saved');vi.stubGlobal('navigator',{onLine:true});
 await writeRecord(owner,'study:daily',{cards:[{imageUrl:'daily-image'}]});
 await writeRecord(owner,'library:manifest',{deckIds:['pack']});
 await writeRecord(owner,'query:/api/decks/pack/view',{deck:{cards:[{imageUrl:'other-image'},{imageUrl:'daily-image'},{imageUrl:'last-image'}]}});
});
it('saves daily artwork first and covers the whole library without waiting for TTS',async()=>{
 await syncSavedArtwork(owner);expect(m.download.mock.calls.map(c=>c[1])).toEqual(['daily-image','other-image','last-image']);
 expect(m.download.mock.calls.every(c=>c[0]===owner&&c[2]===false)).toBe(true);
});
it('continues after one missing file and retries it on a later pass',async()=>{
 m.download.mockRejectedValueOnce(Error('temporary'));await syncSavedArtwork(owner);expect(m.download).toHaveBeenCalledTimes(3);
 await syncSavedArtwork(owner);expect(m.download).toHaveBeenCalledTimes(6);
});
it('does not duplicate overlapping passes',async()=>{
 await Promise.all([syncSavedArtwork(owner),syncSavedArtwork(owner)]);expect(m.download).toHaveBeenCalledTimes(3);
});
it('does not transfer artwork offline or into another account',async()=>{
 vi.stubGlobal('navigator',{onLine:false});await syncSavedArtwork(owner);expect(m.download).not.toHaveBeenCalled();
 vi.stubGlobal('navigator',{onLine:true});m.owner.mockResolvedValue('other');await syncSavedArtwork(owner);expect(m.download).not.toHaveBeenCalled();
});
