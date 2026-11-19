import Foundation
import WebKit

/// Reads the previous app origin without deleting or changing any of its data.
/// One small export document is needed on the first upgrade, not on later launches.
@MainActor final class LegacyMigration: NSObject, WKNavigationDelegate, WKScriptMessageHandlerWithReply {
    private var view: WKWebView?
    private var timeout: DispatchWorkItem?
    private var completion: ((Result<[String:String],Error>) -> Void)?
    private let save: ([String:Any], @escaping (Bool)->Void) -> Void
    enum Failure: Error {case unavailable, invalid}
    init(save: @escaping ([String:Any], @escaping (Bool)->Void)->Void) {self.save=save}
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
        view.load(URLRequest(url:URL(string:"https://flashmind-35q4.onrender.com/native-upgrade.html")!))
    }
    func webView(_ webView:WKWebView,decidePolicyFor action:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void) {
        let url=action.request.url
        decisionHandler(url?.scheme=="https" && url?.host=="flashmind-35q4.onrender.com" && url?.path=="/native-upgrade.html" ? .allow:.cancel)
    }
    func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error){finish(.failure(error))}
    func userContentController(_ controller:WKUserContentController,didReceive message:WKScriptMessage,replyHandler:@escaping(Any?,String?)->Void) {
        guard message.frameInfo.isMainFrame,message.frameInfo.securityOrigin.host=="flashmind-35q4.onrender.com",
              let payload=message.body as? [String:Any] else {replyHandler(nil,"Invalid source");return}
        resetTimeout()
        if payload["kind"] as? String == "record",let record=payload["record"] as? [String:Any] {
            save(record){ok in replyHandler(ok,ok ? nil:"Could not preserve the saved record")}
        } else if payload["kind"] as? String == "done",let storage=payload["storage"] as? [String:String] {
            replyHandler(true,nil);finish(.success(storage))
        } else {replyHandler(nil,"Export failed");finish(.failure(Failure.invalid))}
    }
    private func resetTimeout() {
        timeout?.cancel()
        let task=DispatchWorkItem{[weak self] in self?.finish(.failure(Failure.unavailable))};timeout=task
        DispatchQueue.main.asyncAfter(deadline:.now()+180,execute:task)
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
        const databases=typeof indexedDB.databases==='function'?await indexedDB.databases():null;
        if(!databases || databases.some(d=>d.name==='huella-device-v1')) {
          const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('huella-device-v1');q.onupgradeneeded=()=>{q.transaction.abort();resolve(null)};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
          if(db?.objectStoreNames.contains('records')) {
            const keys=await new Promise((resolve,reject)=>{const q=db.transaction('records').objectStore('records').getAllKeys();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
            for(const key of keys){
              const record=await new Promise((resolve,reject)=>{const q=db.transaction('records').objectStore('records').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
              if(!record)continue;
              if(record.value instanceof Blob){const b=new Uint8Array(await record.value.arrayBuffer());let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));record.value={__huellaBlob:true,type:record.value.type,data:btoa(s)}}
              await send({kind:'record',record});
            }
            db.close();
          }
        }
        const storage={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&(key.startsWith('huella')||key==='theme'))storage[key]=localStorage.getItem(key)}
        await send({kind:'done',storage});
      } catch {await send({kind:'error'})}
    })();
    """#
}
