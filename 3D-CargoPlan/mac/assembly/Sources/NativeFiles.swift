// #created 11/08/2026
import AppKit

func runNativeIO(_ mode:String,input:URL?,output:URL) throws {
    let root=Bundle.main.resourceURL!,p=Process()
    p.executableURL=try nativeRuntime();p.environment=engineEnvironment();p.currentDirectoryURL=root
    p.arguments=[root.appendingPathComponent("native-io.mjs").path,mode,input?.path ?? "-",output.path]
    let logURL=FileManager.default.temporaryDirectory.appendingPathComponent("cargoplan-io-\(UUID().uuidString).log")
    FileManager.default.createFile(atPath:logURL.path,contents:nil)
    let handle=try FileHandle(forWritingTo:logURL);defer {try? handle.close();try? FileManager.default.removeItem(at:logURL)}
    p.standardError=handle;p.standardOutput=handle
    try RepackProcessSlot.shared.start(p);defer {RepackProcessSlot.shared.clear(p)}
    p.waitUntilExit()
    if p.terminationStatus != 0 {throw CheckError(String(data:(try? Data(contentsOf:logURL)) ?? Data(),encoding:.utf8) ?? "文件处理失败")}
}
func pieceFromCargo(_ cargo:[String:JSONValue]) throws -> PieceModel {
    guard let id=cargo["id"]?.string,let dims=cargo["dimensions"]?.object,
          let l=dims["length"]?.number,let w=dims["width"]?.number,let h=dims["height"]?.number,
          let kg=cargo["weight"]?.number,[l,w,h,kg].allSatisfy({$0.isFinite}),min(l,w,h)>0,kg>=0 else {throw CheckError("货物缺少有效 ID、尺寸或重量")}
    var glass=false;if case .bool(let value)=cargo["hasGlass"] ?? .null {glass=value}
    return PieceModel(PieceDTO(id:id,name:cargo["name"]?.string ?? id,category:cargo["category"]?.string ?? "货物",x:0,y:0,z:0,l:l,w:w,h:h,kg:kg,glass:glass,cargo:cargo))
}
func nativeBatchKey(_ piece:PieceModel)->String {
    let raw=piece.cargo["rawData"]?.object ?? [:]
    let row=raw["_sourceRow"]?.string ?? raw["_sourceRow"]?.number.map{String($0)} ?? piece.id
    return "\(raw["_sourceSheet"]?.string ?? piece.category):\(row):\(piece.name)"
}
