import {afterEach,expect,it,vi} from 'vitest';
import {withQueryDeadline} from '@/lib/query-deadline';
afterEach(()=>vi.useRealTimers());
it('ends a refresh whose storage or token lookup never resolves',async()=>{
 vi.useFakeTimers();let signal!:AbortSignal;
 const result=withQueryDeadline(async s=>{signal=s;await new Promise(()=>{});return 'never';},100);
 const check=expect(result).rejects.toThrow('Refresh timed out');
 await vi.advanceTimersByTimeAsync(101);await check;expect(signal.aborted).toBe(true);
});
it('allows a fresh successful retry after a timeout',async()=>{
 vi.useFakeTimers();const failed=withQueryDeadline(()=>new Promise(()=>{}),100);const check=expect(failed).rejects.toThrow();
 await vi.advanceTimersByTimeAsync(101);await check;
 await expect(withQueryDeadline(async()=>({total:120}),100)).resolves.toEqual({total:120});expect(vi.getTimerCount()).toBe(0);
});
it('propagates actual failures and clears its timeout',async()=>{
 vi.useFakeTimers();await expect(withQueryDeadline(async()=>{throw Error('offline');},100)).rejects.toThrow('offline');expect(vi.getTimerCount()).toBe(0);
});
