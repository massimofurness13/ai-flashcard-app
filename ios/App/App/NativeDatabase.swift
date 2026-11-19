import Foundation
import SQLite3
import CryptoKit

/// Account-partitioned durable data. A review and its cursor commit together.
/// Never stores login credentials; those belong in Keychain.
final class NativeDatabase {
    private var db: OpaquePointer?
    private let files: URL
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    enum Failure: Error { case storage, invalidRecord }
    init(directory: URL) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        files = directory.appendingPathComponent("media", isDirectory: true)
        try FileManager.default.createDirectory(at: files, withIntermediateDirectories: true)
        guard sqlite3_open_v2(directory.appendingPathComponent("library.sqlite").path, &db, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else { throw Failure.storage }
        sqlite3_busy_timeout(db, 5000)
        try execute("PRAGMA journal_mode=WAL")
        try execute("PRAGMA synchronous=FULL")
        try execute("CREATE TABLE IF NOT EXISTS records(owner TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, savedAt REAL NOT NULL, PRIMARY KEY(owner,key))")
    }
    deinit { sqlite3_close(db) }
    private func execute(_ sql: String) throws {
        guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else { throw Failure.storage }
    }
    private func statement(_ sql: String, _ args: [String]) throws -> OpaquePointer {
        var s: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &s, nil) == SQLITE_OK, let s else { throw Failure.storage }
        for (index, arg) in args.enumerated() {
            guard sqlite3_bind_text(s, Int32(index+1), arg, -1, transient) == SQLITE_OK else { sqlite3_finalize(s); throw Failure.storage }
        }
        return s
    }
    private func restored(_ value: Any) throws -> Any {
        guard let object = value as? [String: Any], let name = object["__huellaFile"] as? String else { return value }
        // Database corruption must never permit a path outside our media folder.
        guard name.count == 64, name.allSatisfy({ $0.isHexDigit }) else { throw Failure.invalidRecord }
        let bytes = (try? Data(contentsOf: files.appendingPathComponent(name))) ?? Data()
        return ["__huellaBlob": true, "type": object["type"] as? String ?? "application/octet-stream", "data": bytes.base64EncodedString()]
    }
    func read(owner: String, key: String) throws -> [String: Any]? {
        let s = try statement("SELECT key,value,savedAt FROM records WHERE owner=? AND key=?", [owner,key]); defer { sqlite3_finalize(s) }
        let result = sqlite3_step(s)
        if result == SQLITE_DONE { return nil }
        guard result == SQLITE_ROW else { throw Failure.storage }
        return try record(s, owner: owner)
    }
    private func record(_ s: OpaquePointer, owner: String, metadataOnly: Bool = false) throws -> [String: Any] {
        let key = String(cString: sqlite3_column_text(s,0))
        let raw = Data(String(cString: sqlite3_column_text(s,1)).utf8)
        let decoded = try JSONSerialization.jsonObject(with: raw, options: .fragmentsAllowed)
        var value: Any
        if metadataOnly, let object = decoded as? [String:Any], let name = object["__huellaFile"] as? String, name.count==64, name.allSatisfy({$0.isHexDigit}) {
            let attributes = try? FileManager.default.attributesOfItem(atPath:files.appendingPathComponent(name).path)
            value = ["size":attributes?[.size] as? Int ?? 0]
        } else {value = try restored(decoded)}
        return ["owner":owner,"key":key,"value":value,"savedAt":sqlite3_column_double(s,2)]
    }
    func list(owner: String, prefix: String, metadataOnly: Bool = false) throws -> [[String: Any]] {
        // Range rather than LIKE: percent/underscore in a key are literal.
        let s = try statement("SELECT key,value,savedAt FROM records WHERE owner=? AND key>=? AND key<? ORDER BY key", [owner,prefix,prefix+"\u{10ffff}"]); defer { sqlite3_finalize(s) }
        var records: [[String:Any]] = []
        while true {
            let result = sqlite3_step(s)
            if result == SQLITE_DONE { return records }
            guard result == SQLITE_ROW else { throw Failure.storage }
            records.append(try record(s, owner: owner, metadataOnly: metadataOnly))
        }
    }
    func write(owner: String, records: [[String: Any]]) throws {
        guard !owner.isEmpty, owner.count <= 256 else { throw Failure.invalidRecord }
        try execute("BEGIN IMMEDIATE")
        do {
            for r in records {
                guard let key = r["key"] as? String, !key.isEmpty, let input = r["value"] else { throw Failure.invalidRecord }
                var value = input
                if let blob = input as? [String:Any], blob["__huellaBlob"] as? Bool == true {
                    guard let encoded = blob["data"] as? String, let bytes = Data(base64Encoded: encoded) else { throw Failure.invalidRecord }
                    // Immutable content-addressed files: an interrupted transaction
                    // can leave an unused file, never a half-written existing image.
                    let name = SHA256.hash(data: Data(owner.utf8) + bytes).map { String(format:"%02x",$0) }.joined()
                    let path = files.appendingPathComponent(name)
                    if !FileManager.default.fileExists(atPath: path.path) { try bytes.write(to:path, options:.atomic) }
                    value = ["__huellaFile":name,"type":blob["type"] as? String ?? "application/octet-stream"]
                }
                let data = try JSONSerialization.data(withJSONObject:value, options:[.fragmentsAllowed,.sortedKeys])
                let s = try statement("INSERT INTO records(owner,key,value,savedAt) VALUES(?,?,?,?) ON CONFLICT(owner,key) DO UPDATE SET value=excluded.value,savedAt=excluded.savedAt", [owner,key,String(decoding:data,as:UTF8.self)])
                sqlite3_bind_double(s,4,r["savedAt"] as? Double ?? Date().timeIntervalSince1970*1000)
                let result = sqlite3_step(s); sqlite3_finalize(s)
                guard result == SQLITE_DONE else { throw Failure.storage }
            }
            try execute("COMMIT")
        } catch { try? execute("ROLLBACK"); throw error }
    }
    func remove(owner: String, key: String) throws {
        let lookup = try statement("SELECT value FROM records WHERE owner=? AND key=?",[owner,key])
        var filename: String?
        if sqlite3_step(lookup)==SQLITE_ROW {
            let raw=Data(String(cString:sqlite3_column_text(lookup,0)).utf8)
            filename=((try? JSONSerialization.jsonObject(with:raw)) as? [String:Any])?["__huellaFile"] as? String
        }
        sqlite3_finalize(lookup)
        let s = try statement("DELETE FROM records WHERE owner=? AND key=?",[owner,key]); defer {sqlite3_finalize(s)}
        guard sqlite3_step(s) == SQLITE_DONE else {throw Failure.storage}
        if let name=filename,name.count==64,name.allSatisfy({$0.isHexDigit}) {
            let references=try statement("SELECT 1 FROM records WHERE value LIKE ? LIMIT 1",["%"+name+"%"]);defer{sqlite3_finalize(references)}
            if sqlite3_step(references)==SQLITE_DONE {try? FileManager.default.removeItem(at:files.appendingPathComponent(name))}
        }
    }
}
