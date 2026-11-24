import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {leadingSilenceOffset} from '@/lib/audio-leading-silence';
function pcm(onset=.5,amplitude=.1,duration=1){const samples=new Float32Array(1000*duration);for(let i=onset*1000;i<samples.length;i++)samples[i]=amplitude;return {length:samples.length,sampleRate:1000,numberOfChannels:1,duration,getChannelData:()=>samples} as unknown as AudioBuffer;}
it('skips a quiet lead-in while preserving a 120ms guard and original samples',()=>{const b=pcm();expect(leadingSilenceOffset(b)).toBeCloseTo(.38);expect(b.getChannelData(0)[0]).toBe(0);});
it('keeps speech starting immediately and uniformly quiet recordings intact',()=>{expect(leadingSilenceOffset(pcm(0))).toBe(0);expect(leadingSilenceOffset(pcm(0,.001))).toBe(0);});
it('retains a softer opening consonant before the louder vowel',()=>{const b=pcm(.1,.006);b.getChannelData(0).fill(.2,300);expect(leadingSilenceOffset(b)).toBe(0);});
it('ignores isolated clicks without trimming the end or searching deep into a recording',()=>{const b=pcm();b.getChannelData(0)[10]=1;expect(leadingSilenceOffset(b)).toBeCloseTo(.38);expect(leadingSilenceOffset(pcm(1.8,.1,3))).toBe(0);});
it('keeps the earliest channel onset in stereo',()=>{const a=pcm(.5),b=pcm(.1);expect(leadingSilenceOffset({...a,numberOfChannels:2,getChannelData:(i:number)=>(i?a:b).getChannelData(0)})).toBe(0);});
class Context extends EventTarget {
 static instance:Context;state='suspended';destination={};buffer=pcm();
 resume=vi.fn(async()=>{this.state='running';});
 decodeAudioData=vi.fn(async()=>this.buffer);
 sources:{onended:null|(()=>void);start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;connect:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>;buffer:AudioBuffer|null}[]=[];
 createBufferSource(){const source={onended:null as null|(()=>void),start:vi.fn(),stop:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),buffer:null as AudioBuffer|null};this.sources.push(source);return source;}
 constructor(){super();Context.instance=this;}
}
let player:typeof import('@/lib/prepared-audio');
beforeEach(async()=>{vi.resetModules();vi.useFakeTimers();vi.stubGlobal('window',{});vi.stubGlobal('AudioContext',Context);vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Uint8Array([1,2]))));player=await import('@/lib/prepared-audio');});
afterEach(()=>{player.clearPreparedAudio();vi.useRealTimers();vi.unstubAllGlobals();});
it('decodes a local file once and starts repeated playback synchronously at the trim offset',async()=>{
 player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');await player.prepareAudioBuffer('blob:one');
 const ended=vi.fn();const cancel=player.playPreparedAudio('blob:one',1,ended,vi.fn());
 expect(Context.instance.sources[0].start).toHaveBeenCalledWith(0,.38);expect(fetch).toHaveBeenCalledTimes(1);expect(Context.instance.decodeAudioData).toHaveBeenCalledTimes(1);
 Context.instance.sources[0].onended!();cancel!();expect(ended).toHaveBeenCalledTimes(1);expect(Context.instance.sources[0].stop).not.toHaveBeenCalled();
});
it('cancellation never emits completion or affects another source',async()=>{player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');const ended=vi.fn(),cancel=player.playPreparedAudio('blob:one',1,ended,vi.fn());const late=Context.instance.sources[0].onended;cancel!();player.playPreparedAudio('blob:one',1,vi.fn(),vi.fn());late!();expect(ended).not.toHaveBeenCalled();expect(Context.instance.sources[1].stop).not.toHaveBeenCalled();});
it('never fetches remote bytes and preserves pitch-compatible fallback at custom speed',async()=>{expect(await player.prepareAudioBuffer('https://remote/test')).toBe(false);expect(fetch).not.toHaveBeenCalled();player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');expect(player.playPreparedAudio('blob:one',1.2,vi.fn(),vi.fn())).toBeNull();});
it('deduplicates concurrent decoding and lets failed preparation retry',async()=>{player.unlockPreparedAudio();Context.instance.decodeAudioData.mockRejectedValueOnce(new Error('bad file'));expect(await player.prepareAudioBuffer('blob:one')).toBe(false);const [a,b]=await Promise.all([player.prepareAudioBuffer('blob:one'),player.prepareAudioBuffer('blob:one')]);expect([a,b]).toEqual([true,true]);expect(Context.instance.decodeAudioData).toHaveBeenCalledTimes(2);});
it('a stalled decode times out and is retryable',async()=>{player.unlockPreparedAudio();Context.instance.decodeAudioData.mockImplementationOnce(()=>new Promise(()=>{}));const p=player.prepareAudioBuffer('blob:one');await vi.advanceTimersByTimeAsync(3100);expect(await p).toBe(false);expect(await player.prepareAudioBuffer('blob:one')).toBe(true);});
it('account reset discards late decoded buffers',async()=>{player.unlockPreparedAudio();let done!:(value:AudioBuffer)=>void;Context.instance.decodeAudioData.mockImplementationOnce(()=>new Promise(r=>{done=r;}));const p=player.prepareAudioBuffer('blob:old');await vi.advanceTimersByTimeAsync(0);player.clearPreparedAudio();done(pcm());expect(await p).toBe(false);expect(player.isAudioPrepared('blob:old')).toBe(false);});
it('bounds memory and rereads an evicted clip',async()=>{player.unlockPreparedAudio();Context.instance.buffer=pcm(0,.1,1000);for(let i=0;i<9;i++)await player.prepareAudioBuffer('blob:'+i);expect(player.isAudioPrepared('blob:0')).toBe(false);expect(player.isAudioPrepared('blob:8')).toBe(true);});
it('resumes a suspended output without discarding prepared recordings',async()=>{player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');Context.instance.state='suspended';player.unlockPreparedAudio();expect(Context.instance.state).toBe('running');expect(player.isAudioPrepared('blob:one')).toBe(true);});
it('reports an interrupted recording that never ends without counting it as heard',async()=>{player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');const ended=vi.fn(),failed=vi.fn();player.playPreparedAudio('blob:one',1,ended,failed);await vi.advanceTimersByTimeAsync(10000);expect(failed).toHaveBeenCalledTimes(1);expect(ended).not.toHaveBeenCalled();});
it('waits for delayed interrupted-state resume without dropping prepared buffers',async()=>{
 player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');
 Context.instance.state='interrupted';let resume!:()=>void;
 Context.instance.resume.mockImplementationOnce(()=>new Promise<void>(resolve=>{resume=()=>{Context.instance.state='running';resolve();};}));
 const ready=player.ensurePreparedAudioRunning();expect(player.playPreparedAudio('blob:one',1,vi.fn(),vi.fn())).toBeNull();
 resume();expect(await ready).toBe(true);expect(player.playPreparedAudio('blob:one',1,vi.fn(),vi.fn())).not.toBeNull();
});
it('bounds a never-settling resume instead of hanging playback forever',async()=>{
 player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');Context.instance.state='interrupted';Context.instance.resume.mockImplementationOnce(()=>new Promise(()=>{}));
 const ready=player.ensurePreparedAudioRunning();await vi.advanceTimersByTimeAsync(501);expect(await ready).toBe(false);
});
it('replaces a frozen output on foreground while keeping decoded recordings',async()=>{
 player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');const old=Context.instance;
 Object.assign(old,{currentTime:0,close:vi.fn(async()=>{old.state='closed';})});
 const recovering=player.recoverPreparedAudio();await vi.advanceTimersByTimeAsync(61);expect(await recovering).toBe(true);
 expect(Context.instance).not.toBe(old);expect(player.isAudioPrepared('blob:one')).toBe(true);expect(player.playPreparedAudio('blob:one',1,vi.fn(),vi.fn())).not.toBeNull();expect(fetch).toHaveBeenCalledTimes(1);
});
it('keeps a healthy advancing context on foreground',async()=>{
 player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');const old=Context.instance;
 Object.defineProperty(old,'currentTime',{get:()=>Date.now()/1000});const recovering=player.recoverPreparedAudio();await vi.advanceTimersByTimeAsync(61);expect(await recovering).toBe(true);expect(Context.instance).toBe(old);
});
it('a reset prevents a late foreground recovery from replacing the new output',async()=>{
 player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');const old=Context.instance;Object.assign(old,{currentTime:0,close:vi.fn()});
 const recovering=player.recoverPreparedAudio();player.clearPreparedAudio();await vi.advanceTimersByTimeAsync(61);expect(await recovering).toBe(false);expect(Context.instance).toBe(old);expect(player.isAudioPrepared('blob:one')).toBe(false);
});
it('deduplicates simultaneous foreground recovery requests',async()=>{
 player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');
 Object.defineProperty(Context.instance,'currentTime',{get:()=>Date.now()/1000});
 const a=player.recoverPreparedAudio(),b=player.recoverPreparedAudio();expect(a).toBe(b);
 await vi.advanceTimersByTimeAsync(61);expect(await a).toBe(true);
});
it('reset during replacement resume ignores the obsolete recovery result',async()=>{
 player.unlockPreparedAudio();await player.prepareAudioBuffer('blob:one');const old=Context.instance;
 Object.assign(old,{currentTime:0,close:vi.fn(async()=>{old.state='closed';})});
 let done!:()=>void;
 class SlowReplacement extends Context { resume=vi.fn(()=>new Promise<void>(resolve=>{done=resolve;})); }
 vi.stubGlobal('AudioContext',SlowReplacement);
 const recovering=player.recoverPreparedAudio();await vi.advanceTimersByTimeAsync(61);
 player.clearPreparedAudio();done();expect(await recovering).toBe(false);
 Context.instance.state='running';expect(await player.ensurePreparedAudioRunning()).toBe(true);
});
