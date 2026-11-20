import Foundation
import WebKit

/// Reads the previous app origin without deleting or changing any of its data.
/// One small export document is needed on the first upgrade, not on later launches.
@MainActor final class LegacyMigration: NSObject, WKNavigationDelegate, WKScriptMessageHandlerWithReply {
    private var view: WKWebView?
    private var timeout: DispatchWorkItem?
    private var completion: ((Result<[String:String],Error>) -> Void)?
    private let save: ([String:Any], @escaping (Bool)->Void) -> Void
    private let ready: ([String:String], @escaping (Bool)->Void) -> Void
    private let progress: (Int,Int) -> Void
    enum Failure: Error {case unavailable, invalid}
    init(save: @escaping ([String:Any], @escaping (Bool)->Void)->Void,
         ready: @escaping ([String:String], @escaping (Bool)->Void)->Void,
         progress: @escaping (Int,Int)->Void) {self.save=save;self.ready=ready;self.progress=progress}
    func start(_ completion:@escaping (Result<[String:String],Error>)->Void) {
        self.completion=completion
        let config=WKWebViewConfiguration();config.websiteDataStore = .default();config.limitsNavigationsToAppBoundDomains=true
        config.userContentController.addScriptMessageHandler(self,contentWorld:.page,name:"huellaMigration")
        var seed=""
        #if DEBUG
        if let path=ProcessInfo.processInfo.environment["HUELLA_OFFLINE_FIXTURE"],let data=try? Data(contentsOf:URL(fileURLWithPath:path)),let fixture=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],fixture["owner"] as? String == "11111111-1111-4111-8111-111111111111",fixture["migration"] as? Bool == true,let script=fixture["migrationSeed"] as? String {seed=script}
        #endif
        config.userContentController.addUserScript(WKUserScript(source:seed+Self.exportScript,injectionTime:.atDocumentEnd,forMainFrameOnly:true))
        let view=WKWebView(frame:.zero,configuration:config);self.view=view;view.navigationDelegate=self
        resetTimeout()
        view.load(URLRequest(url:URL(string:"https://flashmind-35q4.onrender.com/native-upgrade.html")!,cachePolicy:.reloadIgnoringLocalCacheData,timeoutInterval:20))
    }
    func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void) {
        let url=action.request.url
        decisionHandler(url?.scheme=="https" && url?.host=="flashmind-35q4.onrender.com" && url?.path=="/native-upgrade.html" ? .allow:.cancel)
    }
    func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error){finish(.failure(error))}
    func webView(_ webView:WKWebView,didFail navigation:WKNavigation!,withError error:Error){finish(.failure(error))}
    func webViewWebContentProcessDidTerminate(_ webView:WKWebView){finish(.failure(Failure.unavailable))}
    func cancel(){finish(.failure(Failure.unavailable))}
    func userContentController(_ controller:WKUserContentController,didReceive message:WKScriptMessage,replyHandler:@escaping(Any?,String?)->Void) {
        guard completion != nil,message.frameInfo.isMainFrame,message.frameInfo.securityOrigin.host=="flashmind-35q4.onrender.com",
              let payload=message.body as? [String:Any] else {replyHandler(nil,"Invalid source");return}
        resetTimeout()
        if payload["kind"] as? String == "record",let record=payload["record"] as? [String:Any] {
            save(record){ok in replyHandler(ok,ok ? nil:"Could not preserve the saved record")}
        } else if payload["kind"] as? String == "ready",let storage=payload["storage"] as? [String:String] {
            ready(storage){ok in replyHandler(ok,ok ? nil:"Could not preserve settings")}
        } else if payload["kind"] as? String == "progress",let completed=payload["completed"] as? Int,let total=payload["total"] as? Int {
            progress(completed,total);replyHandler(true,nil)
        } else if payload["kind"] as? String == "done",let storage=payload["storage"] as? [String:String] {
            replyHandler(true,nil);finish(.success(storage))
        } else {replyHandler(nil,"Export failed");finish(.failure(Failure.invalid))}
    }
    private func resetTimeout() {
        timeout?.cancel()
        let task=DispatchWorkItem{[weak self] in self?.finish(.failure(Failure.unavailable))};timeout=task
        DispatchQueue.main.asyncAfter(deadline:.now()+30,execute:task)
    }
    private func finish(_ result:Result<[String:String],Error>) {
        guard let done=completion else{return};completion=nil;timeout?.cancel();timeout=nil
        view?.stopLoading();view?.configuration.userContentController.removeScriptMessageHandler(forName:"huellaMigration",contentWorld:.page);view=nil
        done(result)
    }
    private static let exportScript = #"""
    if(location.origin==='https://flashmind-35q4.onrender.com' && location.pathname==='/native-upgrade.html') (async()=>{
      const send=value=>window.webkit.messageHandlers.huellaMigration.postMessage(value);
      try {
        if(window.__huellaMigrationSeed)await window.__huellaMigrationSeed;
        const storage={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&(key.startsWith('huella')||key==='theme'))storage[key]=localStorage.getItem(key)}
        let ready=false;
        const databases=typeof indexedDB.databases==='function'?await indexedDB.databases():null;
        if(!databases || databases.some(d=>d.name==='huella-device-v1')) {
          const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('huella-device-v1');q.onupgradeneeded=()=>{q.transaction.abort();resolve(null)};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
          if(db?.objectStoreNames.contains('records')) {
            const keys=await new Promise((resolve,reject)=>{const q=db.transaction('records').objectStore('records').getAllKeys();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
            const media=key=>Array.isArray(key)&&String(key[1]).startsWith('media:');
            const essential=keys.filter(key=>!media(key));
            async function copy(key){
              const record=await new Promise((resolve,reject)=>{const q=db.transaction('records').objectStore('records').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
              if(!record)return;
              if(record.value instanceof Blob){const b=new Uint8Array(await record.value.arrayBuffer());let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));record.value={__huellaBlob:true,type:record.value.type,data:btoa(s)}}
              await send({kind:'record',record});
            }
            await send({kind:'progress',completed:0,total:essential.length});
            for(let i=0;i<essential.length;i++){await copy(essential[i]);if(i%10===0||i===essential.length-1)await send({kind:'progress',completed:i+1,total:essential.length});}
            // All reviews, edits, plans and settings are durable before the UI opens.
            // Images/audio follow without blocking the learner. Keep the old store intact.
            await send({kind:'ready',storage});ready=true;
            for(const key of keys.filter(media))await copy(key);
            db.close();
          }
        }
        if(!ready)await send({kind:'ready',storage});
        await send({kind:'done',storage});
      } catch {await send({kind:'error'})}
    })();
    """#
}
