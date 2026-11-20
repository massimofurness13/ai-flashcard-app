import Foundation
@main struct Test {
 static func main() throws {
  let path=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  defer {try? FileManager.default.removeItem(at:path)}
  do {
   let db=try NativeDatabase(directory:path)
   try db.write(owner:"a",records:[["key":"review:1","value":["quality":4]],["key":"checkpoint","value":["index":1]]])
   let other=try db.read(owner:"b",key:"review:1");assert(other == nil)
   do {try db.write(owner:"a",records:[["key":"checkpoint","value":["index":2]],["value":3]]);fatalError("Expected rejection")} catch {}
   let record=try db.read(owner:"a",key:"checkpoint")!;assert((record["value"] as! [String:Int])["index"]==1)
   try db.write(owner:"a",records:[["key":"media:1","value":["__huellaBlob":true,"type":"audio/mpeg","data":Data([1,2,3]).base64EncodedString()]]])
  }
  let reopened=try NativeDatabase(directory:path)
  let media=try reopened.read(owner:"a",key:"media:1")!["value"] as! [String:Any]
  assert(media["data"] as! String=="AQID")
  let metadata=try reopened.read(owner:"a",key:"media:1",metadataOnly:true)!["value"] as! [String:Any]
  assert(metadata["size"] as! Int == 3)
  assert(metadata["data"] == nil) // Availability never serializes audio/image bytes.
  let otherMetadata=try reopened.read(owner:"b",key:"media:1",metadataOnly:true)
  assert(otherMetadata == nil)
  let mediaDirectory=path.appendingPathComponent("media")
  for file in try FileManager.default.contentsOfDirectory(at:mediaDirectory,includingPropertiesForKeys:nil) {try FileManager.default.removeItem(at:file)}
  let missing=try reopened.read(owner:"a",key:"media:1",metadataOnly:true)!["value"] as! [String:Any]
  assert(missing["size"] as! Int == 0) // Do not trust a stale record when its file is missing.
  let reviews=try reopened.list(owner:"a",prefix:"review:");assert(reviews.count==1)
  try reopened.remove(owner:"b",key:"review:1")
  let original=try reopened.read(owner:"a",key:"review:1");assert(original != nil)
  print("PASS: atomic rollback, account isolation, media persistence, reopen, prefix selection, scoped deletion")
 }
}
