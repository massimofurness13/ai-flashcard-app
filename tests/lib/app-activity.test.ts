import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const native=vi.hoisted(()=>({isNativePlatform:vi.fn(),addListener:vi.fn(),getState:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:native.isNativePlatform}}));
vi.mock('@capacitor/app',()=>({App:{addListener:native.addListener,getState:native.getState}}));
let activity:typeof import('@/lib/app-activity');let notifyNative:(state:{isActive:boolean})=>void;
beforeEach(async()=>{vi.resetModules();vi.clearAllMocks();native.isNativePlatform.mockReturnValue(true);native.addListener.mockImplementation((_name,fn)=>{notifyNative=fn;return Promise.resolve({remove:vi.fn()});});native.getState.mockResolvedValue({isActive:true});vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',Object.assign(new EventTarget(),{visibilityState:'visible'}));activity=await import('@/lib/app-activity');});
afterEach(()=>vi.unstubAllGlobals());
it('native background/foreground advances one replay generation despite duplicate browser events',async()=>{
 const changed=vi.fn(),unsub=activity.subscribeAppActivity(changed);await Promise.resolve();notifyNative({isActive:false});expect(activity.getAppActivity().active).toBe(false);
 Object.assign(document,{visibilityState:'hidden'});document.dispatchEvent(new Event('visibilitychange'));notifyNative({isActive:true});Object.assign(document,{visibilityState:'visible'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pageshow'));notifyNative({isActive:true});
 expect(activity.getAppActivity()).toEqual({active:true,generation:1});expect(changed).toHaveBeenCalledTimes(2);unsub();
});
it('does not let a stale initial native state overwrite a newer foreground event',async()=>{
 let done!:(state:{isActive:boolean})=>void;native.getState.mockImplementationOnce(()=>new Promise(resolve=>{done=resolve;}));activity.subscribeAppActivity(vi.fn());notifyNative({isActive:false});notifyNative({isActive:true});done({isActive:false});await Promise.resolve();expect(activity.getAppActivity()).toEqual({active:true,generation:1});
});
it('browser-only hiding and restoration works without native plugins',()=>{
 native.isNativePlatform.mockReturnValue(false);activity.subscribeAppActivity(vi.fn());Object.assign(document,{visibilityState:'hidden'});document.dispatchEvent(new Event('visibilitychange'));expect(activity.getAppActivity().active).toBe(false);Object.assign(document,{visibilityState:'visible'});window.dispatchEvent(new Event('pageshow'));expect(activity.getAppActivity()).toEqual({active:true,generation:1});expect(native.addListener).not.toHaveBeenCalled();
});
