import { beforeEach, afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/device-media", () => ({
  deviceOwner: async () => null, audioKey: (t: string) => t,
  resolveSavedAudio: vi.fn(), savedMedia: vi.fn(), downloadMedia: vi.fn(),
}));
vi.mock("@/lib/device-db", () => ({ writeRecord: vi.fn() }));

class FakeAudio extends EventTarget {
  static instance: FakeAudio;
  src = ""; paused = true; preload = ""; muted = false;
  currentTime = 0; playbackRate = 1;
  play = vi.fn(() => { this.paused = false; return Promise.resolve(); });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn();
  constructor() { super(); FakeAudio.instance = this; }
}
let tts: typeof import("@/lib/tts");
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({audioUrl:"https://test/clip.mp3"})));
  tts = await import("@/lib/tts");
});
afterEach(() => { tts.clearAudioMemory(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function warm(text = "hello") { await tts.preloadAudio(text, "en-GB-m"); }
async function flush() { for (let i = 0; i < 15; i++) await Promise.resolve(); }

it("an old handle cannot pause the next card's audio", async () => {
  await warm(); const previous = tts.speak("hello", {languageCode:"en-GB-m"});
  tts.speak("hello", {languageCode:"en-GB-m"});
  previous.cancel(); expect(FakeAudio.instance.paused).toBe(false);
});
it("a delayed unlock completion cannot pause a real phrase", async () => {
  await warm(); tts.unlockAudio();
  tts.speak("hello", {languageCode:"en-GB-m"});
  await flush(); expect(FakeAudio.instance.paused).toBe(false);
});
it("a superseded slow lookup cannot replace the current phrase", async () => {
  await warm(); let finish!: (r: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(r => {finish = r;}));
  tts.speak("slow", {languageCode:"en-GB-m"}); await flush();
  tts.speak("hello", {languageCode:"en-GB-m"});
  finish(Response.json({audioUrl:"https://test/old.mp3"})); await flush();
  expect(FakeAudio.instance.src).toBe("https://test/clip.mp3");
});
it("retries a transient playback failure once before reporting failure", async () => {
  await warm(); tts.unlockAudio(); await flush();
  FakeAudio.instance.play.mockRejectedValueOnce(new DOMException("interrupted", "AbortError"));
  const failed = vi.fn(); const ended = vi.fn();
  const h = tts.speak("hello", {languageCode:"en-GB-m"}); h.onError?.(failed); h.onEnded?.(ended);
  await vi.advanceTimersByTimeAsync(300);
  expect(FakeAudio.instance.play).toHaveBeenCalledTimes(3);
  expect(failed).not.toHaveBeenCalled();
  FakeAudio.instance.dispatchEvent(new Event("ended")); expect(ended).toHaveBeenCalledTimes(1);
});
it("cancellation during retry never starts the old clip again", async () => {
  await warm(); tts.unlockAudio(); await flush();
  FakeAudio.instance.play.mockRejectedValueOnce(new Error("temporary"));
  const h = tts.speak("hello", {languageCode:"en-GB-m"}); await flush(); h.cancel();
  await vi.advanceTimersByTimeAsync(1000); expect(FakeAudio.instance.play).toHaveBeenCalledTimes(2);
});
it("settles a failed clip once, even if the media event and play promise both fail", async () => {
  await warm(); tts.unlockAudio(); await flush();
  FakeAudio.instance.play.mockRejectedValue(new DOMException("blocked", "NotAllowedError"));
  const failed = vi.fn(), ended = vi.fn(); const h = tts.speak("hello", {languageCode:"en-GB-m"});
  h.onError?.(failed); h.onEnded?.(ended);
  FakeAudio.instance.dispatchEvent(new Event("error")); await vi.advanceTimersByTimeAsync(1000);
  expect(failed).toHaveBeenCalledTimes(1); expect(ended).not.toHaveBeenCalled();
});
it("bounds a stalled media load and reports failure instead of completion", async () => {
  await warm(); tts.unlockAudio(); await flush();
  FakeAudio.instance.play.mockImplementation(() => new Promise(() => {}));
  const failed = vi.fn(), ended = vi.fn();
  const h = tts.speak("hello", {languageCode:"en-GB-m"}); h.onError?.(failed); h.onEnded?.(ended);
  await vi.advanceTimersByTimeAsync(17000);
  expect(FakeAudio.instance.play).toHaveBeenCalledTimes(3);
  expect(failed).toHaveBeenCalledTimes(1); expect(ended).not.toHaveBeenCalled();
});
it("clearing the account invalidates pending speech", async () => {
  let finish!: (r: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(r => {finish=r;}));
  tts.speak("old account", {languageCode:"en-GB-m"}); await flush();
  tts.clearAudioMemory(); finish(Response.json({audioUrl:"https://test/old.mp3"})); await flush();
  expect(tts.getCachedAudioUrl("old account", "en-GB-m")).toBeNull();
});
it("finishes only the current card once when media ends", async () => {
  await warm(); const oldEnded=vi.fn(), newEnded=vi.fn();
  const old=tts.speak("hello", {languageCode:"en-GB-m"}); old.onEnded?.(oldEnded);
  const next=tts.speak("hello", {languageCode:"en-GB-m"}); next.onEnded?.(newEnded);
  FakeAudio.instance.dispatchEvent(new Event("ended")); FakeAudio.instance.dispatchEvent(new Event("ended"));
  expect(oldEnded).not.toHaveBeenCalled(); expect(newEnded).toHaveBeenCalledTimes(1);
});

class PreparedContext extends EventTarget {
  static instance: PreparedContext;state='suspended';destination={};
  sources:{buffer:unknown;connect:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>;start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;onended:null|(()=>void)}[]=[];
  resume=vi.fn(async()=>{this.state='running';});
  decodeAudioData=vi.fn(async()=>{const samples=new Float32Array(1000);samples.fill(.1,500);return {duration:1,length:1000,numberOfChannels:1,sampleRate:1000,getChannelData:()=>samples};});
  constructor(){super();PreparedContext.instance=this;}
  createBufferSource(){const s={buffer:null as unknown,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null as null|(()=>void)};this.sources.push(s);return s;}
}
it('offline preloaded speech starts from decoded memory without reloading the HTML player',async()=>{
  vi.stubGlobal('AudioContext',PreparedContext);vi.stubGlobal('navigator',{onLine:false});
  const media=await import('@/lib/device-media');
  vi.spyOn(media,'deviceOwner').mockResolvedValue('owner');
  vi.mocked(media.resolveSavedAudio).mockResolvedValue('https://saved/clip');vi.mocked(media.savedMedia).mockResolvedValue('blob:saved');
  vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array([1,2])));
  tts.unlockAudio();await tts.preloadAudio('hola','es-MX');await flush();
  const loads=FakeAudio.instance.load.mock.calls.length;
  const ended=vi.fn(),h=tts.speak('hola',{languageCode:'es-MX'});h.onEnded?.(ended);
  expect(PreparedContext.instance.sources[0].start).toHaveBeenCalledWith(0,.38);
  expect(FakeAudio.instance.load).toHaveBeenCalledTimes(loads);
  expect(fetch).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledWith('blob:saved',expect.anything());
  expect(media.downloadMedia).not.toHaveBeenCalled();
  expect((await import('@/lib/device-db')).writeRecord).not.toHaveBeenCalled();
  PreparedContext.instance.sources[0].onended!();expect(ended).toHaveBeenCalledTimes(1);
  vi.restoreAllMocks();
});
it('missing offline audio fails promptly without TTS requests or retries',async()=>{
  vi.stubGlobal('navigator',{onLine:false});const failed=vi.fn();
  const media=await import('@/lib/device-media');vi.spyOn(media,'deviceOwner').mockResolvedValue('owner');vi.mocked(media.resolveSavedAudio).mockResolvedValue(null);
  const h=tts.speak('missing',{languageCode:'es-MX'});h.onError?.(failed);await flush();
  expect(failed).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
