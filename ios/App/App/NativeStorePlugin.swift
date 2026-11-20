import Capacitor
import Foundation
import Security
import WebKit

@objc(NativeStorePlugin)
final class NativeStorePlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "NativeStorePlugin"
    let jsName = "NativeStore"
    let pluginMethods: [CAPPluginMethod] = ["read","mediaStatus","list","write","remove","secretGet","secretSet","migrateLegacy","summary"].map { CAPPluginMethod(name:$0, returnType:CAPPluginReturnPromise) }
    private var migration: LegacyMigration?
    @objc func migrateLegacy(_ call:CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard migration == nil else {call.reject("Upgrade is already running");return}
            if UserDefaults.standard.bool(forKey:"huella-native-migration-v1") {call.resolve(["complete":true]);return}
            WKWebsiteDataStore.default().fetchDataRecords(ofTypes:[WKWebsiteDataTypeIndexedDBDatabases,WKWebsiteDataTypeLocalStorage]) { [self] records in
                var migrationFixture=false
                #if DEBUG
                if let path=ProcessInfo.processInfo.environment["HUELLA_OFFLINE_FIXTURE"],let data=try? Data(contentsOf:URL(fileURLWithPath:path)),let fixture=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],fixture["owner"] as? String == "11111111-1111-4111-8111-111111111111" {migrationFixture=fixture["migration"] as? Bool == true}
                #endif
                guard migrationFixture || records.contains(where:{$0.displayName.contains("onrender.com")}) else {
                    UserDefaults.standard.set(true,forKey:"huella-native-migration-v1");call.resolve(["complete":true]);return
                }
                let task=LegacyMigration{ [self] record,reply in
                    queue.async { [self] in
                        do {
                            guard let owner=record["owner"] as? String,let key=record["key"] as? String else {throw NativeDatabase.Failure.invalidRecord}
                            let db=try database()
                            if try db.read(owner:owner,key:key)==nil {try db.write(owner:owner,records:[record])}
                            DispatchQueue.main.async {reply(true)}
                        } catch {DispatchQueue.main.async {reply(false)}}
                    }
                }
                migration=task
                task.start{ [self] result in
                    migration=nil
                    switch result {
                    case .success(let storage):
                        // Do not clear the original web-origin data. It remains a recovery copy.
                        queue.async { [self] in
                            do {try database().write(owner:"__device__",records:[["key":"legacy-storage","value":storage]])
                                DispatchQueue.main.async { [self] in
                                    preserveLegacySession(signedOut:storage["huella:device-sign-out:v1"] != nil) {
                                        UserDefaults.standard.set(true,forKey:"huella-native-migration-v1")
                                        call.resolve(["complete":true,"storage":storage])
                                    }
                                }
                            } catch {call.reject("Could not finish preserving your previous library")}
                        }
                    case .failure: call.resolve(["complete":false])
                    }
                }
            }
        }
    }
    private let queue = DispatchQueue(label:"app.huella.storage")
    private var store: NativeDatabase?
    private func database() throws -> NativeDatabase {
        if let store {return store}
        let directory = try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true).appendingPathComponent("Huella",isDirectory:true)
        let created = try NativeDatabase(directory:directory); store=created; return created
    }
    private func perform(_ call: CAPPluginCall, _ block: @escaping (NativeDatabase) throws -> [String:Any]) {
        queue.async { [self] in
            do { let result = try block(database()); call.resolve(result) }
            catch { call.reject("Could not save or read this device’s data. Your existing records have not been cleared.", nil, error) }
        }
    }
    @objc func read(_ call: CAPPluginCall) {
        guard let owner=call.getString("owner"), let key=call.getString("key") else {call.reject("Missing record address");return}
        perform(call) {db in if let record=try db.read(owner:owner,key:key) {return ["record":record]};return [:]}
    }
    // Availability checks never load/base64-encode the media file into the WebView.
    @objc func mediaStatus(_ call: CAPPluginCall) {
        guard let owner=call.getString("owner"), let keys=call.getArray("keys",String.self),
              keys.count <= 2000, keys.allSatisfy({$0.hasPrefix("media:")}) else {call.reject("Invalid media keys");return}
        perform(call) { db in
            var present: [String] = []
            for key in keys {
                if let record=try db.read(owner:owner,key:key,metadataOnly:true),
                   let value=record["value"] as? [String:Any], (value["size"] as? Int ?? 0)>0 {present.append(key)}
            }
            return ["keys":present]
        }
    }
    @objc func list(_ call: CAPPluginCall) {
        guard let owner=call.getString("owner") else {call.reject("Missing account");return}
        perform(call) {try ["records":$0.list(owner:owner,prefix:call.getString("prefix") ?? "")]}
    }
    @objc func write(_ call: CAPPluginCall) {
        guard let owner=call.getString("owner"), let records=call.getArray("records",[String:Any].self) else {call.reject("Missing records");return}
        perform(call) {try $0.write(owner:owner,records:records);return [:]}
    }
    @objc func remove(_ call: CAPPluginCall) {
        guard let owner=call.getString("owner"), let key=call.getString("key") else {call.reject("Missing record address");return}
        perform(call) {try $0.remove(owner:owner,key:key);return [:]}
    }
    // Transfer only our Supabase session from this app's old cookie store.
    // Credentials never enter the migration document, device database or logs.
    private func preserveLegacySession(signedOut:Bool,done:@escaping()->Void) {
        guard !signedOut else {done();return}
        let key="sb-fghxwycixcawwtctknmp-auth-token"
        WKWebsiteDataStore.default().httpCookieStore.getAllCookies { [self] cookies in
            let relevant=cookies.filter { $0.domain=="flashmind-35q4.onrender.com" && ($0.name==key || $0.name.hasPrefix(key+".")) }
            let direct=relevant.first(where:{$0.name==key})?.value
            let chunks=relevant.filter{$0.name.hasPrefix(key+".")}.sorted{(Int($0.name.dropFirst(key.count+1)) ?? 0)<(Int($1.name.dropFirst(key.count+1)) ?? 0)}.map(\.value).joined()
            var encoded=(direct ?? chunks).removingPercentEncoding ?? (direct ?? chunks)
            var data:Data?
            if encoded.hasPrefix("base64-") {
                encoded=String(encoded.dropFirst(7)).replacingOccurrences(of:"-",with:"+").replacingOccurrences(of:"_",with:"/")
                encoded += String(repeating:"=",count:(4-encoded.count%4)%4);data=Data(base64Encoded:encoded)
            } else {data=encoded.data(using:.utf8)}
            guard let data,let object=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],
                  object["access_token"] is String,object["refresh_token"] is String else {done();return}
            queue.async { [self] in
                var query=secretQuery(key);query[kSecReturnData as String]=true
                var existing:CFTypeRef?
                if SecItemCopyMatching(query as CFDictionary,&existing)==errSecItemNotFound {
                    var added=secretQuery(key);added[kSecValueData as String]=data
                    added[kSecAttrAccessible as String]=kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
                    _ = SecItemAdd(added as CFDictionary,nil)
                }
                DispatchQueue.main.async {done()}
            }
        }
    }
    @objc func summary(_ call:CAPPluginCall) {
        guard let owner=call.getString("owner") else {call.reject("Missing account");return}
        perform(call) { db in
            let records=try db.list(owner:owner,prefix:"",metadataOnly:true)
            let media=records.filter{($0["key"] as? String ?? "").hasPrefix("media:")}
            let reviews=records.filter{($0["key"] as? String ?? "").hasPrefix("review:")}
            let plans=records.filter{($0["key"] as? String ?? "").hasPrefix("plan:")}
            let keys=records.compactMap{$0["key"] as? String}.filter{$0.hasPrefix("media:") || $0.hasPrefix("pack:")}
            return ["files":media.count,"bytes":media.reduce(0){$0+(($1["value"] as? [String:Any])?["size"] as? Int ?? 0)},"reviews":reviews.count,"errors":reviews.filter{($0["value"] as? [String:Any])?["error"] != nil}.count,"planErrors":plans.filter{($0["value"] as? [String:Any])?["error"] != nil}.count,"mediaKeys":keys]
        }
    }
    private func secretQuery(_ key: String) -> [String:Any] {
        [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"app.huella.auth",kSecAttrAccount as String:key]
    }
    @objc func secretGet(_ call: CAPPluginCall) {
        guard let key=call.getString("key"), key.hasPrefix("sb-") else {call.reject("Invalid credential key");return}
        queue.async { [self] in
            var query=secretQuery(key); query[kSecReturnData as String]=true; query[kSecMatchLimit as String]=kSecMatchLimitOne
            var result:CFTypeRef?; let status=SecItemCopyMatching(query as CFDictionary,&result)
            if status==errSecItemNotFound {call.resolve();return}
            guard status==errSecSuccess, let data=result as? Data else {call.reject("Secure storage is unavailable");return}
            call.resolve(["value":String(decoding:data,as:UTF8.self)])
        }
    }
    @objc func secretSet(_ call: CAPPluginCall) {
        guard let key=call.getString("key"), key.hasPrefix("sb-") else {call.reject("Invalid credential key");return}
        queue.async { [self] in
            let query=secretQuery(key)
            guard let value=call.getString("value") else {
                let status=SecItemDelete(query as CFDictionary)
                if status==errSecSuccess || status==errSecItemNotFound {call.resolve()} else {call.reject("Secure storage is unavailable")};return
            }
            let update=[kSecValueData as String:Data(value.utf8)]
            var status=SecItemUpdate(query as CFDictionary,update as CFDictionary)
            if status==errSecItemNotFound {
                var added=query; added[kSecValueData as String]=Data(value.utf8)
                added[kSecAttrAccessible as String]=kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
                status=SecItemAdd(added as CFDictionary,nil)
            }
            if status==errSecSuccess {call.resolve()} else {call.reject("Secure storage is unavailable")}
        }
    }
}
