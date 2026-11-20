import Capacitor
import Foundation
import Security
import WebKit

@objc(NativeStorePlugin)
final class NativeStorePlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "NativeStorePlugin"
    let jsName = "NativeStore"
    let pluginMethods: [CAPPluginMethod] = ["read","mediaStatus","list","write","remove","secretGet","secretSet","recoverLegacySession","migrateLegacy","summary"].map { CAPPluginMethod(name:$0, returnType:CAPPluginReturnPromise) }
    private var migration: LegacyMigration?
    private var migrationAttempt: UUID?
    private var migrationWatchdog: DispatchWorkItem?
    private var migrationCall: CAPPluginCall?
    private let libraryMigratedKey = "huella-native-library-migrated-v1"

    @objc func migrateLegacy(_ call:CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            let full = UserDefaults.standard.bool(forKey:"huella-native-migration-v1")
            let libraryReady = full || UserDefaults.standard.bool(forKey:libraryMigratedKey)
            if libraryReady {call.resolve(["complete":true])}
            if full {return}
            guard migrationAttempt == nil else {
                if !libraryReady {call.reject("Upgrade is already running")};return
            }
            let attempt=UUID();migrationAttempt=attempt
            if !libraryReady {migrationCall=call}
            // Includes website-data enumeration and cookie transfer, not just navigation.
            let watchdog=DispatchWorkItem { [weak self] in
                guard let self,self.migrationAttempt==attempt else{return}
                self.finishMigration(attempt:attempt,complete:false)
            }
            migrationWatchdog=watchdog
            DispatchQueue.main.asyncAfter(deadline:.now()+40,execute:watchdog)
            WKWebsiteDataStore.default().fetchDataRecords(ofTypes:[WKWebsiteDataTypeIndexedDBDatabases,WKWebsiteDataTypeLocalStorage]) { [self] records in
                guard migrationAttempt==attempt else{return}
                var migrationFixture=false
                #if DEBUG
                if let path=ProcessInfo.processInfo.environment["HUELLA_OFFLINE_FIXTURE"],let data=try? Data(contentsOf:URL(fileURLWithPath:path)),let fixture=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],fixture["owner"] as? String == "11111111-1111-4111-8111-111111111111" {migrationFixture=fixture["migration"] as? Bool == true}
                #endif
                guard migrationFixture || records.contains(where:{$0.displayName.contains("onrender.com")}) else {
                    UserDefaults.standard.set(true,forKey:"huella-native-migration-v1")
                    finishMigration(attempt:attempt,complete:true);return
                }
                let task=LegacyMigration(save:{ [self] record,reply in
                    queue.async { [self] in
                        do {
                            guard let owner=record["owner"] as? String,let key=record["key"] as? String else {throw NativeDatabase.Failure.invalidRecord}
                            let db=try database()
                            // Retry never overwrites edits made in the new app; no media decoding.
                            if try db.read(owner:owner,key:key,metadataOnly:true)==nil {try db.write(owner:owner,records:[record])}
                            DispatchQueue.main.async {reply(true)}
                        } catch {DispatchQueue.main.async {reply(false)}}
                    }
                },ready:{ [self] storage,reply in
                    queue.async { [self] in
                        do {
                            try database().write(owner:"__device__",records:[["key":"legacy-storage","value":storage]])
                            DispatchQueue.main.async { [self] in
                                guard migrationAttempt==attempt else {reply(false);return}
                                preserveLegacySession(signedOut:storage["huella:device-sign-out:v1"] != nil) { [self] in
                                    guard migrationAttempt==attempt else {reply(false);return}
                                    UserDefaults.standard.set(true,forKey:libraryMigratedKey)
                                    migrationWatchdog?.cancel();migrationWatchdog=nil
                                    migrationCall?.resolve(["complete":true,"storage":storage]);migrationCall=nil
                                    reply(true)
                                }
                            }
                        } catch {DispatchQueue.main.async {reply(false)}}
                    }
                },progress:{ [self] completed,total in
                    notifyListeners("migrationProgress",data:["completed":completed,"total":total])
                })
                migration=task
                task.start { [self] result in
                    guard migrationAttempt==attempt else{return}
                    if case .success = result {UserDefaults.standard.set(true,forKey:"huella-native-migration-v1")}
                    finishMigration(attempt:attempt,complete:UserDefaults.standard.bool(forKey:libraryMigratedKey))
                }
            }
        }
    }
    @MainActor private func finishMigration(attempt:UUID,complete:Bool) {
        guard migrationAttempt==attempt else{return}
        migrationAttempt=nil;migrationWatchdog?.cancel();migrationWatchdog=nil
        let task=migration;migration=nil;task?.cancel()
        migrationCall?.resolve(["complete":complete]);migrationCall=nil
    }
    private let queue = DispatchQueue(label:"app.huella.storage")
    private var store: NativeDatabase?
    // Accessed only on the storage queue; prevents late cookie recovery after logout.
    private var credentialGeneration = 0
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
    private func preserveLegacySession(signedOut:Bool,expectedOwner:String?=nil,expectedGeneration:Int?=nil,done:@escaping()->Void) {
        guard !signedOut else {done();return}
        let key="sb-fghxwycixcawwtctknmp-auth-token"
        queue.async { [self] in
         let generation=expectedGeneration ?? credentialGeneration
         DispatchQueue.main.async { [self] in
          WKWebsiteDataStore.default().httpCookieStore.getAllCookies { [self] cookies in
            let relevant=cookies.filter { $0.domain.trimmingCharacters(in:CharacterSet(charactersIn:"."))=="flashmind-35q4.onrender.com" && ($0.name==key || $0.name.hasPrefix(key+".")) }
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
            if let expectedOwner,(object["user"] as? [String:Any])?["id"] as? String != expectedOwner {done();return}
            queue.async { [self] in
                guard credentialGeneration==generation else {DispatchQueue.main.async {done()};return}
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
        }
    }
    @objc func recoverLegacySession(_ call:CAPPluginCall) {
        guard let owner=call.getString("owner"),!owner.isEmpty,owner.count<=256 else {call.reject("Missing account");return}
        queue.async { [self] in
            let generation=credentialGeneration
            DispatchQueue.main.async { [self] in
                preserveLegacySession(signedOut:call.getBool("signedOut") ?? true,expectedOwner:owner,expectedGeneration:generation) {call.resolve([:])}
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
            if status==errSecItemNotFound {call.resolve([:]);return}
            guard status==errSecSuccess, let data=result as? Data else {call.reject("Secure storage is unavailable");return}
            call.resolve(["value":String(decoding:data,as:UTF8.self)])
        }
    }
    @objc func secretSet(_ call: CAPPluginCall) {
        guard let key=call.getString("key"), key.hasPrefix("sb-") else {call.reject("Invalid credential key");return}
        queue.async { [self] in
            if key=="sb-fghxwycixcawwtctknmp-auth-token" {credentialGeneration += 1}
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
