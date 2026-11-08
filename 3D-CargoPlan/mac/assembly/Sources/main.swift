// #created 11/08/2026
import AppKit
import SceneKit
import UniformTypeIdentifiers

// MARK: - Model

struct DimsDTO: Codable { var length, width, height: Double }
struct ConfigDTO: Codable {
    var algorithm: String?
    var containerDimensions: DimsDTO
    var containerMaxWeight: Double
    var timeLimit: Double?
    var loadingProfile: String?
    var verticalSupport: String?
    var supportCriterion: String?
    var offsetStackScope: String?
    var clearanceMm: Double?
}

struct PieceDTO: Codable {
    var id: String
    var name: String
    var category: String
    var x, y, z, l, w, h, kg: Double
    var glass: Bool
    var cargo: [String: JSONValue]
}

struct BayDTO: Codable {
    var id: String
    var title: String
    var length, width, height: Double
    var maxWeight: Double?
    var items: [PieceDTO]
}

struct SceneDTO: Codable {
    var config: ConfigDTO
    var containers: [BayDTO]
    var pending: [PieceDTO]
    var summary: String?
    var seed: [String: JSONValue]?
    var dirty:Bool?=nil
}

enum JSONValue: Codable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([String: JSONValue].self) { self = .object(value) }
        else if let value = try? container.decode([JSONValue].self) { self = .array(value) }
        else { throw DecodingError.dataCorruptedError(in: container, debugDescription: "unsupported JSON") }
    }
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        }
    }
    var object: [String: JSONValue]? { if case .object(let value) = self { return value } else { return nil } }
    var number: Double? { if case .number(let value) = self { return value } else { return nil } }
    var string: String? { if case .string(let value) = self { return value } else { return nil } }
}

final class PieceModel {
    let id: String
    var name: String
    var category: String
    var length, width, height, kilograms: Double
    var glass: Bool
    var homeX, homeY, homeZ: Double
    var x, y, z: Double
    var cargo: [String: JSONValue]
    init(_ piece: PieceDTO) {
        id = piece.id
        name = piece.name
        category = piece.category
        length = piece.l
        width = piece.w
        height = piece.h
        kilograms = piece.kg
        glass = piece.glass
        homeX = piece.x
        homeY = piece.y
        homeZ = piece.z
        x = piece.x
        y = piece.y
        z = piece.z
        cargo = piece.cargo
    }
    func restorePose() { x = homeX; y = homeY; z = homeZ }
    func dto(atHome: Bool = false) -> PieceDTO {
        PieceDTO(id: id, name: name, category: category, x: atHome ? 0 : x, y: atHome ? 0 : y, z: atHome ? 0 : z, l: length, w: width, h: height, kg: kilograms, glass: glass, cargo: cargoPayload())
    }
    func cargoPayload() -> [String: JSONValue] {
        var next = cargo
        next["id"] = .string(id)
        next["name"] = .string(name)
        next["category"] = .string(category)
        next["weight"] = .number(kilograms)
        next["quantity"] = .number(1)
        next["hasGlass"] = .bool(glass)
        next["dimensions"] = .object([
            "length": .number(sourceDimension("length", fallback: length)),
            "width": .number(sourceDimension("width", fallback: width)),
            "height": .number(sourceDimension("height", fallback: height))
        ])
        if next["allowedOrientations"] == nil { next["allowedOrientations"] = .array([.string("standing"), .string("lying"), .string("flat")]) }
        if next["canStackOnTop"] == nil { next["canStackOnTop"] = .bool(true) }
        if next["canOffsetStack"] == nil { next["canOffsetStack"] = .bool(false) }
        if next["colorTag"] == nil { next["colorTag"] = .string("默认") }
        if next["rawData"] == nil { next["rawData"] = .object([:]) }
        return next
    }
    private func sourceDimension(_ key: String, fallback: Double) -> Double {
        cargo["dimensions"]?.object?[key]?.number ?? fallback
    }
    func applySourceDimensions(length: Double, width: Double, height: Double) {
        var dims = cargo["dimensions"]?.object ?? [:]
        dims["length"] = .number(length)
        dims["width"] = .number(width)
        dims["height"] = .number(height)
        cargo["dimensions"] = .object(dims)
        self.length = length
        self.width = width
        self.height = height
    }
}

final class BayModel {
    let id: String
    var title: String
    var length, width, height, maxWeight: Double
    var pieces: [PieceModel]
    init(_ bay: BayDTO) {
        id = bay.id
        title = bay.title
        length = bay.length
        width = bay.width
        height = bay.height
        maxWeight = bay.maxWeight ?? 26000
        pieces = bay.items.map(PieceModel.init)
    }
}

final class WorkspaceModel {
    var config: ConfigDTO
    var bays: [BayModel]
    var pending: [PieceModel]
    var summary: String
    var seed: [String: JSONValue]?
    var dirty = false
    init(_ scene: SceneDTO) {
        seed = scene.seed
        config = scene.config
        bays = scene.containers.map(BayModel.init)
        pending = scene.pending.map(PieceModel.init)
        if bays.isEmpty {
            bays = [BayModel(BayDTO(id: "empty-preview", title: "空舱预览（全部待装）", length: config.containerDimensions.length, width: config.containerDimensions.width, height: config.containerDimensions.height, maxWeight: config.containerMaxWeight, items: []))]
        }
        summary = scene.summary ?? ""
        dirty=scene.dirty ?? false
    }
    func allPieces() -> [PieceModel] { bays.flatMap(\.pieces) + pending }
    func removeFromBay(_ piece: PieceModel) {
        for bay in bays { bay.pieces.removeAll { $0.id == piece.id } }
    }
    func enqueuePending(_ piece: PieceModel) {
        removeFromBay(piece)
        if !pending.contains(where: { $0.id == piece.id }) {
            piece.x = 0; piece.y = 0; piece.z = 0
            pending.insert(piece, at: 0)
        }
        dirty = true
    }
    func dto() -> SceneDTO {
        SceneDTO(
            config: config,
            containers: bays.map { BayDTO(id: $0.id, title: $0.title, length: $0.length, width: $0.width, height: $0.height, maxWeight: $0.maxWeight, items: $0.pieces.map { $0.dto() }) },
            pending: pending.map { $0.dto(atHome: true) },
            summary: summary, seed: seed,dirty:dirty
        )
    }
}

final class InspectorDocument:NSView {override var isFlipped:Bool {true}}

func clampedOrigin(_ origin: Double, size: Double, limit: Double) -> Double {
    min(max(0, origin), max(0, limit - size))
}
func rangesOverlap(_ origin: Double, _ size: Double, _ other: Double, _ otherSize: Double) -> Bool {
    origin + size > other + 0.5 && other + otherSize > origin + 0.5
}
func piecesOverlap(_ a: PieceModel, _ b: PieceModel) -> Bool {
    rangesOverlap(a.x, a.length, b.x, b.length) && rangesOverlap(a.y, a.width, b.y, b.width) && rangesOverlap(a.z, a.height, b.z, b.height)
}
func clamp(_ piece: PieceModel, inside bay: BayModel) {
    piece.x = clampedOrigin(piece.x, size: piece.length, limit: bay.length)
    piece.y = clampedOrigin(piece.y, size: piece.width, limit: bay.width)
    piece.z = clampedOrigin(piece.z, size: piece.height, limit: bay.height)
}

private let palette = ["#398d9e", "#5b82aa", "#95ada6", "#8c87ac", "#6ca8b2", "#b38d70", "#7c9a73"]
func pieceColor(_ piece: PieceModel) -> NSColor {
    if piece.glass { return NSColor(srgbRed: 0.831, green: 0.608, blue: 0.278, alpha: 1) }
    var hash = 0
    for scalar in piece.category.unicodeScalars { hash = (hash &* 31) &+ Int(scalar.value) }
    let hex = palette[Int(UInt(bitPattern: hash) % UInt(palette.count))]
    let value = Int(hex.dropFirst(), radix: 16) ?? 0
    return NSColor(srgbRed: CGFloat((value >> 16) & 255) / 255, green: CGFloat((value >> 8) & 255) / 255, blue: CGFloat(value & 255) / 255, alpha: 1)
}

final class CargoBox: SCNNode {
    let pieceID: String
    init(pieceID: String) { self.pieceID = pieceID; super.init() }
    required init?(coder: NSCoder) { nil }
}

// MARK: - Scene

final class AssemblySceneView: SCNView {
    var interactionLocked = false
    var bay: BayModel?
    var onSelection: ((String?) -> Void)?
    var onMoved: (() -> Void)?
    var onInvalidDrop: ((PieceModel) -> Void)?
    var resizingContainer=false {didSet{updateResizeHandles()}}
    var onResizePreview:((DimsDTO)->Void)?
    var onResizeCommitted:((DimsDTO)->Void)?
    private var outlineNode:SCNNode?
    private var resizeFloorNode:SCNNode?
    private var resizeHandles:[SCNNode]=[]
    private var resizeDrag:(axis:Int,start:NSPoint,dims:DimsDTO,vector:NSPoint)?
    private var previewDims:DimsDTO?
    private var pieceByID: [String: PieceModel] = [:]
    private var boxByID: [String: CargoBox] = [:]
    private var selectedID: String?
    private var overlapping: Set<String> = []
    private var drag: Drag?
    private let cameraNode = SCNNode()

    private struct Drag {
        let pieceID: String
        let startX, startY, startZ: Double
        let anchor: SCNVector3
        let startWindowY: CGFloat
    }

    func show(_ bay: BayModel,preserveCamera:Bool=false) {
        let oldCamera=preserveCamera ? pointOfView?.worldTransform:nil
        self.bay = bay
        pieceByID = Dictionary(uniqueKeysWithValues: bay.pieces.map { ($0.id, $0) })
        selectedID = nil
        drag = nil
        allowsCameraControl = true
        defaultCameraController.interactionMode = .orbitTurntable
        antialiasingMode = .multisampling4X
        let scene = SCNScene()
        scene.background.contents = NSColor(srgbRed: 0.063, green: 0.090, blue: 0.122, alpha: 1)
        let length = CGFloat(bay.length / 1000), width = CGFloat(bay.width / 1000), height = CGFloat(bay.height / 1000)
        let ambient = SCNNode(); ambient.light = SCNLight(); ambient.light?.type = .ambient; ambient.light?.intensity = 320
        let sun = SCNNode(); sun.light = SCNLight(); sun.light?.type = .directional; sun.light?.intensity = 780; sun.eulerAngles = SCNVector3(-0.9, 0.55, 0)
        scene.rootNode.addChildNode(ambient); scene.rootNode.addChildNode(sun)
        let floor = SCNBox(width: length + 1.6, height: 0.02, length: width + 1.6, chamferRadius: 0)
        floor.firstMaterial?.diffuse.contents = NSColor(white: 0.14, alpha: 1)
        let floorNode = SCNNode(geometry: floor); floorNode.position = SCNVector3(length / 2, -0.02, width / 2)
        scene.rootNode.addChildNode(floorNode);resizeFloorNode=floorNode
        let shell = SCNBox(width: length, height: height, length: width, chamferRadius: 0)
        shell.firstMaterial?.fillMode = .lines
        shell.firstMaterial?.diffuse.contents = NSColor(white: 0.78, alpha: 1)
        let shellNode = SCNNode(geometry: shell); shellNode.position = SCNVector3(length / 2, height / 2, width / 2)
        scene.rootNode.addChildNode(shellNode);outlineNode=shellNode
        boxByID = [:]
        for piece in bay.pieces {
            let box = SCNBox(width: CGFloat(piece.length / 1000), height: CGFloat(piece.height / 1000), length: CGFloat(piece.width / 1000), chamferRadius: 0.004)
            let material = SCNMaterial(); material.lightingModel = .physicallyBased; material.diffuse.contents = pieceColor(piece); material.roughness.contents = 0.62; material.metalness.contents = 0.05
            box.materials = [material]
            let node = CargoBox(pieceID: piece.id); node.categoryBitMask = 2; node.geometry = box; place(node, piece)
            scene.rootNode.addChildNode(node); boxByID[piece.id] = node
        }
        cameraNode.camera = SCNCamera(); cameraNode.camera?.zFar = 80; cameraNode.camera?.fieldOfView = 42
        cameraNode.position = SCNVector3(Float(length) * 1.45, Float(height) / 2 + Float(length) * 0.8, Float(width) / 2 + Float(length) * 1.15)
        cameraNode.look(at: SCNVector3(length / 2, height / 2, width / 2))
        scene.rootNode.addChildNode(cameraNode)
        if let oldCamera {cameraNode.transform=oldCamera}
        self.scene = scene; pointOfView = cameraNode
        previewDims=DimsDTO(length:bay.length,width:bay.width,height:bay.height);resizeHandles=[];updateResizeHandles()
        defaultCameraController.target = SCNVector3(length / 2, height / 2, width / 2)
        refreshOverlap(notify: false)
    }

    func resizeHandleLocation(_ axis:Int)->NSPoint? {
        guard resizeHandles.indices.contains(axis) else{return nil}
        let p=projectPoint(resizeHandles[axis].position);return convert(NSPoint(x:CGFloat(p.x),y:CGFloat(p.y)),to:nil)
    }
    private func updateResizeHandles() {
        resizeHandles.forEach{$0.removeFromParentNode()};resizeHandles=[]
        guard resizingContainer,let scene,let d=previewDims else{return}
        for (i,color) in [NSColor.systemBlue,.systemGreen,.systemOrange].enumerated() {
            let node=SCNNode(geometry:SCNSphere(radius:0.14));node.geometry?.firstMaterial?.diffuse.contents=color;node.geometry?.firstMaterial?.lightingModel = .constant;node.geometry?.firstMaterial?.readsFromDepthBuffer=false;node.renderingOrder=50
            let text=SCNText(string:["内长 ↔","内宽 ↔","内高 ↕"][i],extrusionDepth:0);text.font = .systemFont(ofSize:16,weight:.semibold);text.firstMaterial?.diffuse.contents=color;text.firstMaterial?.lightingModel = .constant
            let label=SCNNode(geometry:text);label.scale=SCNVector3(0.014,0.014,0.014);label.position=SCNVector3(0.14,0.1,0);label.constraints=[SCNBillboardConstraint()];node.addChildNode(label)
            scene.rootNode.addChildNode(node);resizeHandles.append(node)
        };previewContainer(d)
    }
    private func previewContainer(_ d:DimsDTO) {
        previewDims=d
        let l=CGFloat(d.length/1000),w=CGFloat(d.width/1000),h=CGFloat(d.height/1000)
        SCNTransaction.begin();SCNTransaction.animationDuration=0
        if let box=outlineNode?.geometry as? SCNBox {box.width=l;box.length=w;box.height=h;outlineNode?.position=SCNVector3(l/2,h/2,w/2)}
        if let floor=resizeFloorNode?.geometry as? SCNBox {floor.width=l+1.6;floor.length=w+1.6;resizeFloorNode?.position=SCNVector3(l/2,-0.02,w/2)}
        if resizeHandles.count==3 {resizeHandles[0].position=SCNVector3(l,0.1,w/2);resizeHandles[1].position=SCNVector3(l/2,0.1,w);resizeHandles[2].position=SCNVector3(l/2,h,w/2)}
        SCNTransaction.commit()
    }

    func select(_ id: String?) { selectedID = id; refreshMaterials(); onSelection?(id) }
    func selectedPiece() -> PieceModel? { selectedID.flatMap { pieceByID[$0] } }
    func overlapCount() -> Int { overlapping.count }
    func rebuildSelectedGeometry() {
        guard let id = selectedID, let piece = pieceByID[id], let node = boxByID[id] else { return }
        let box = SCNBox(width: CGFloat(piece.length / 1000), height: CGFloat(piece.height / 1000), length: CGFloat(piece.width / 1000), chamferRadius: 0.004)
        let material = SCNMaterial(); material.lightingModel = .physicallyBased; material.diffuse.contents = pieceColor(piece); material.roughness.contents = 0.62; material.metalness.contents = 0.05
        box.materials = [material]; node.geometry = box; place(node, piece); refreshOverlap(notify: true)
    }
    func removePiece(_ id: String) {
        boxByID[id]?.removeFromParentNode(); boxByID[id] = nil; pieceByID[id] = nil
        if selectedID == id { select(nil) }
        refreshOverlap(notify: true)
    }

    override var acceptsFirstResponder: Bool { true }

    override func mouseDown(with event: NSEvent) {
        if interactionLocked { return }
        window?.makeFirstResponder(self)
        if resizingContainer {
            let point=convert(event.locationInWindow,from:nil)
            if let axis=resizeHandles.indices.min(by:{a,b in let pa=projectPoint(resizeHandles[a].position),pb=projectPoint(resizeHandles[b].position);return hypot(Double(pa.x)-point.x,Double(pa.y)-point.y)<hypot(Double(pb.x)-point.x,Double(pb.y)-point.y)}),let bay {
                let node=resizeHandles[axis],p=projectPoint(node.position)
                if hypot(Double(p.x)-point.x,Double(p.y)-point.y)<24 {
                    var end=node.position;if axis==0{end.x+=1}else if axis==1{end.z+=1}else{end.y+=1}
                    let q=projectPoint(end)
                    resizeDrag=(axis,point,DimsDTO(length:bay.length,width:bay.width,height:bay.height),NSPoint(x:CGFloat(q.x-p.x),y:CGFloat(q.y-p.y)))
                    allowsCameraControl=false;return
                }
            }
            allowsCameraControl=true;super.mouseDown(with:event);return
        }
        if let piece = piece(at: event) {
            allowsCameraControl = false
            select(piece.id)
            let centerY = CGFloat((piece.z + piece.height / 2) / 1000)
            let point = convert(event.locationInWindow, from: nil)
            let anchor = pointOnPlane(viewPoint: point, planeY: centerY) ?? SCNVector3((piece.x + piece.length / 2) / 1000, centerY, (piece.y + piece.width / 2) / 1000)
            drag = Drag(pieceID: piece.id, startX: piece.x, startY: piece.y, startZ: piece.z, anchor: anchor, startWindowY: event.locationInWindow.y)
        } else {
            drag = nil; allowsCameraControl = true; select(nil); super.mouseDown(with: event)
        }
    }

    override func mouseDragged(with event: NSEvent) {
        if interactionLocked { return }
        if let r=resizeDrag {
            let point=convert(event.locationInWindow,from:nil),v=r.vector,den=v.x*v.x+v.y*v.y
            if den>0.01 {
                let delta=Double(((point.x-r.start.x)*v.x+(point.y-r.start.y)*v.y)/den)*1000
                var d=r.dims;let original=r.axis==0 ? d.length:r.axis==1 ? d.width:d.height
                let value=min(50000,max(100,((original+delta)/10).rounded()*10))
                if r.axis==0{d.length=value}else if r.axis==1{d.width=value}else{d.height=value}
                previewContainer(d);onResizePreview?(d)
            };return
        }
        guard let drag, let bay, let piece = pieceByID[drag.pieceID], let node = boxByID[drag.pieceID] else { super.mouseDragged(with: event); return }
        if event.modifierFlags.contains(.option) {
            piece.z = drag.startZ + Double(event.locationInWindow.y - drag.startWindowY) * 4
        } else if let point = pointOnPlane(viewPoint: convert(event.locationInWindow, from: nil), planeY: drag.anchor.y) {
            piece.x = drag.startX + Double(point.x - drag.anchor.x) * 1000
            piece.y = drag.startY + Double(point.z - drag.anchor.z) * 1000
        }
        clamp(piece, inside: bay); place(node, piece); refreshOverlap(notify: true)
    }

    override func mouseUp(with event: NSEvent) {
        if let r=resizeDrag,let d=previewDims {
            resizeDrag=nil;allowsCameraControl=true
            if d.length != r.dims.length || d.width != r.dims.width || d.height != r.dims.height {onResizeCommitted?(d)}
            return
        }
        if let drag, let piece = pieceByID[drag.pieceID] {
            let changed = piece.x != drag.startX || piece.y != drag.startY || piece.z != drag.startZ
            let invalid = changed && (bay?.pieces.contains { $0.id != piece.id && piecesOverlap($0, piece) } == true)
            self.drag = nil
            allowsCameraControl = true
            if invalid { onInvalidDrop?(piece) }
            else if changed { onMoved?() }
        } else { super.mouseUp(with: event) }
    }

    override func keyDown(with event: NSEvent) {
        if interactionLocked { return }
        if event.keyCode==53,let r=resizeDrag {resizeDrag=nil;previewContainer(r.dims);onResizePreview?(r.dims);allowsCameraControl=true;return}
        let step = event.modifierFlags.contains(.shift) ? 50.0 : 10.0
        let lift = event.modifierFlags.contains(.option)
        switch event.keyCode {
        case 123: nudge(x: -step)
        case 124: nudge(x: step)
        case 125: if lift { nudge(z: -step) } else { nudge(y: step) }
        case 126: if lift { nudge(z: step) } else { nudge(y: -step) }
        default: super.keyDown(with: event)
        }
    }

    private func nudge(x: Double = 0, y: Double = 0, z: Double = 0) {
        guard let bay, let id = selectedID, let piece = pieceByID[id], let node = boxByID[id] else { return }
        piece.x += x; piece.y += y; piece.z += z; clamp(piece, inside: bay); place(node, piece); refreshOverlap(notify: true)
    }
    private func piece(at event: NSEvent) -> PieceModel? {
        let point=convert(event.locationInWindow,from:nil)
        let a=unprojectPoint(SCNVector3(point.x,point.y,0)),b=unprojectPoint(SCNVector3(point.x,point.y,1))
        // Intersect cargo bounds directly. Wireframe shells and stale SceneKit presentation nodes must not consume the pick.
        let origin=[Double(a.x)*1000,Double(a.z)*1000,Double(a.y)*1000]
        let direction=[Double(b.x-a.x)*1000,Double(b.z-a.z)*1000,Double(b.y-a.y)*1000]
        var nearest=Double.infinity,selected:PieceModel?
        for piece in pieceByID.values {
            let low=[piece.x,piece.y,piece.z],sizes=[piece.length,piece.width,piece.height]
            var enter=0.0,leave=1.0,hit=true
            for axis in 0..<3 {
                if abs(direction[axis])<1e-9 {
                    if origin[axis]<low[axis] || origin[axis]>low[axis]+sizes[axis] {hit=false;break}
                } else {
                    let t1=(low[axis]-origin[axis])/direction[axis],t2=(low[axis]+sizes[axis]-origin[axis])/direction[axis]
                    enter=max(enter,min(t1,t2));leave=min(leave,max(t1,t2))
                    if enter>leave {hit=false;break}
                }
            }
            if hit && enter<nearest {nearest=enter;selected=piece}
        }
        return selected
    }
    private func pointOnPlane(viewPoint: CGPoint, planeY: CGFloat) -> SCNVector3? {
        let near = unprojectPoint(SCNVector3(viewPoint.x, viewPoint.y, 0))
        let far = unprojectPoint(SCNVector3(viewPoint.x, viewPoint.y, 1))
        let dy = far.y - near.y
        if abs(dy) < 0.00001 { return nil }
        let t = (planeY - near.y) / dy
        if t < 0 || t > 1 { return nil }
        return SCNVector3(near.x + (far.x - near.x) * t, planeY, near.z + (far.z - near.z) * t)
    }
    private func place(_ node: CargoBox, _ piece: PieceModel) {
        node.position = SCNVector3((piece.x + piece.length / 2) / 1000, (piece.z + piece.height / 2) / 1000, (piece.y + piece.width / 2) / 1000)
    }
    private func refreshOverlap(notify: Bool) {
        guard let bay else { return }
        var bad = Set<String>()
        let pieces = bay.pieces
        for i in pieces.indices {
            for j in pieces.index(after: i)..<pieces.count where piecesOverlap(pieces[i], pieces[j]) {
                bad.insert(pieces[i].id); bad.insert(pieces[j].id)
            }
        }
        overlapping = bad; refreshMaterials(); if notify { onMoved?() }
    }
    private func refreshMaterials() {
        for (id, node) in boxByID {
            guard let piece = pieceByID[id], let material = node.geometry?.firstMaterial else { continue }
            material.diffuse.contents = pieceColor(piece)
            if overlapping.contains(id) { material.emission.contents = NSColor(srgbRed: 0.75, green: 0.16, blue: 0.12, alpha: 1) }
            else if id == selectedID { material.emission.contents = NSColor(srgbRed: 1, green: 0.78, blue: 0.2, alpha: 1) }
            else { material.emission.contents = NSColor.black }
        }
    }
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate, NSTableViewDataSource, NSTableViewDelegate, NSTextFieldDelegate {
    private var workspace: WorkspaceModel!
    private var bayIndex = 0
    private var window: NSWindow?
    private var editedID: String?
    private var editing = false
    private var busy = false
    private var computeToken:UUID?
    private var computeCancellation:EngineCancellation?
    private var suppress = false
    private var updatingPicker = false

    private let workspaceHost = NSView()
    private var assemblyPage: NSView!
    private var globePage: NativeGlobePanel?
    private var assemblyActions: NSStackView!
    private let embeddedWorkspace = WorkspaceWeb()
    private var floatingSupport:FloatingSupport!
    private var supportPort:String?
    private var fileButtons: [NSButton] = []
    private var editorWorkspace: WorkspaceWeb?
    private var editorPanel: NSPanel?
    private var editorTargetID: String?
    private let catalogButton = NSButton(title: "完整知识目录",target:nil,action:nil)
    private let sceneView = AssemblySceneView()
    private let tabs = NSSegmentedControl(labels: ["装配", "多站点", "海运知识库"], trackingMode: .selectOne, target: nil, action: nil)
    private let pendingStrip = NSScrollView()
    private let pendingStack = NSStackView()
    private let recalcButton = NSButton(title: "重新计算", target: nil, action: nil)
    private let exitEditButton = NSButton(title: "退出编辑", target: nil, action: nil)
    private let bayPicker = NSPopUpButton()
    private let table = NSTableView()
    private let vehicleSpec = NSTextField(wrappingLabelWithString: "")
    private let status = NSTextField(wrappingLabelWithString: "")
    private let nameField = NSTextField()
    private let lengthField = NSTextField(); private let widthField = NSTextField(); private let heightField = NSTextField(); private let weightField = NSTextField()
    private let cargoLength=NSTextField(),cargoWidth=NSTextField(),cargoHeight=NSTextField()
    private let resizeToggle=NSButton(checkboxWithTitle:"在 3D 中拖拽调整货舱",target:nil,action:nil)
    private let undoResize=NSButton(title:"撤销调整",target:nil,action:nil)
    private var vehicleUndo:(scene:SceneDTO,dirty:Bool)?
    private let editorBox = NSStackView()
    private let progress = NSProgressIndicator()
    private var autosaveTask:DispatchWorkItem?
    private let autosaveQueue=DispatchQueue(label:"cargoplan.workspace-save")
    private let computeMode=NSPopUpButton()
    private let progressText=NSTextField(wrappingLabelWithString:"快速模式优先修复当前方案；需要比较新装法时选择深度优化。")

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.appearance = NSAppearance(named: .darkAqua)
        installMenu()
        do { workspace = WorkspaceModel(try loadScene()) }
        catch {
            NSAlert(error: error).runModal(); NSApp.terminate(nil); return
        }
        buildWindow()
        embeddedWorkspace.onMessage = { [weak self] message in self?.handleWorkspaceMessage(message) }
        showBay(0)
        refreshChrome()
        if !CommandLine.arguments.contains(where:{$0.hasSuffix("-smoke")}){NSApp.activate(ignoringOtherApps:true)}
        if CommandLine.arguments.contains("--cancel-smoke"){DispatchQueue.main.async{self.runCancelSmoke()}}
        if CommandLine.arguments.contains("--resize-smoke"){DispatchQueue.main.async{self.runResizeSmoke()}}
        if CommandLine.arguments.contains("--drag-smoke") { DispatchQueue.main.async { self.runDragSmoke() } }
        if CommandLine.arguments.contains("--full-editor-smoke") { DispatchQueue.main.async { self.runFullEditorSmoke() } }
        if CommandLine.arguments.contains("--shell-smoke") { DispatchQueue.main.async { self.runShellSmoke() } }
        if CommandLine.arguments.contains("--route-demo-smoke") { DispatchQueue.main.async { self.runRouteDemoSmoke() } }
        if CommandLine.arguments.contains("--support-smoke") { DispatchQueue.main.async { self.runSupportSmoke() } }
        if CommandLine.arguments.contains("--edit-preview-smoke") {DispatchQueue.main.async{self.runEditPreviewSmoke()}}
        if CommandLine.arguments.contains("--vehicle-route-smoke"){DispatchQueue.main.async{self.runManualRouteSmoke(sideVehicle:true)}}
        if CommandLine.arguments.contains("--manual-route-smoke") { DispatchQueue.main.async { self.runManualRouteSmoke() } }
        if CommandLine.arguments.contains("--ui-smoke") { DispatchQueue.main.async { self.runInterfaceSmoke() } }
    }

    private func runEditPreviewSmoke() {
        let ids=Set(workspace.allPieces().map(\.id)),piece=workspace.bays[0].pieces.first!
        beginEdit(piece.id);lengthField.stringValue="50000"
        controlTextDidEndEditing(Notification(name:NSControl.textDidEndEditingNotification,object:lengthField))
        precondition(workspace.pending.contains{$0.id==piece.id} && !workspace.bays[0].pieces.contains{$0.id==piece.id},"尺寸变化未移出原位置")
        precondition(editedID==piece.id && editing && !editorBox.isHidden,"转待装后编辑器丢失，不能继续改宽高")
        widthField.stringValue="333";heightField.stringValue="444"
        controlTextDidEndEditing(Notification(name:NSControl.textDidEndEditingNotification,object:heightField))
        precondition(piece.cargo["dimensions"]?.object?["width"]?.number==333 && piece.cargo["dimensions"]?.object?["height"]?.number==444,"连续编辑未写入")
        precondition(Set(workspace.allPieces().map(\.id))==ids && computeToken==nil && !busy,"编辑丢件或触发自动重算")
        do {
            let url=FileManager.default.temporaryDirectory.appendingPathComponent("cargoplan-save-check-\(UUID().uuidString).json");defer{try? FileManager.default.removeItem(at:url)}
            try persistWorkspace(workspace.dto(),to:url)
            let restored=WorkspaceModel(try JSONDecoder().decode(SceneDTO.self,from:Data(contentsOf:url)))
            precondition(restored.dirty && restored.pending.contains{$0.id==piece.id} && Set(restored.allPieces().map(\.id))==ids,"保存恢复丢失待装或编辑状态")
            fputs("NATIVE_EDIT_PREVIEW_OK ended_editing=true pending=true continued_width_height=true no_auto_solve=true cargo_conserved=true persisted=true\n",stdout);NSApp.terminate(nil)
        }catch{fputs("EDIT_PREVIEW_FAILED: \(error)\n",stderr);exit(1)}
    }
    private func runCancelSmoke() {
        let ids=Set(workspace.allPieces().map(\.id))
        recalculate();exitOrCancel()
        DispatchQueue.main.asyncAfter(deadline:.now()+0.4){
            precondition(!self.busy && self.computeToken==nil && !RepackProcessSlot.shared.hasRunningProcess(),"启动前取消失效")
            self.recalculate()
            DispatchQueue.main.asyncAfter(deadline:.now()+0.15){
                self.exitOrCancel()
                DispatchQueue.main.asyncAfter(deadline:.now()+0.8){
                    precondition(!self.busy && self.computeToken==nil && !RepackProcessSlot.shared.hasRunningProcess(),"运行中取消或迟到回调失效")
                    precondition(Set(self.workspace.allPieces().map(\.id))==ids,"取消计算改变了货物清单")
                    fputs("NATIVE_CANCEL_OK before_start=true running=true stale_callback_ignored=true cargo_preserved=true\n",stdout);NSApp.terminate(nil)
                }
            }
        }
    }

    private func runResizeSmoke() {
        var a=workspace.bays[0].pieces[0].dto(),b=a
        a.id="resize-inside";a.x=0;a.y=0;a.z=0;a.l=600;a.w=400;a.h=300
        b.id="resize-outside";b.x=2000;b.y=0;b.z=0;b.l=600;b.w=400;b.h=300
        workspace.bays[0].pieces=[PieceModel(a),PieceModel(b)];workspace.bays=[workspace.bays[0]];workspace.pending=[];workspace.dirty=false;workspace.seed=nil;showBay(0)
        let old=workspace.config.containerDimensions
        cargoLength.stringValue="1000";cargoWidth.stringValue=String(old.width);cargoHeight.stringValue=String(old.height);applyContainerSize()
        precondition(workspace.bays[0].pieces.map(\.id)==[a.id] && workspace.pending.map(\.id)==[b.id],"缩小应只移出越界货物")
        precondition(workspace.allPieces().count==2 && workspace.dirty,"货物必须守恒且待重算")
        undoContainerSize();precondition(workspace.pending.isEmpty && workspace.bays[0].pieces.count==2 && !workspace.dirty,"撤销未恢复")
        resizeToggle.state = .on;toggleContainerResize();window?.contentView?.layoutSubtreeIfNeeded()
        guard let point=sceneView.resizeHandleLocation(2) else{fatalError("缺少高度手柄")}
        func event(_ type:NSEvent.EventType,_ p:NSPoint)->NSEvent{NSEvent.mouseEvent(with:type,location:p,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window!.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:1)!}
        sceneView.mouseDown(with:event(.leftMouseDown,point));sceneView.mouseDragged(with:event(.leftMouseDragged,NSPoint(x:point.x,y:point.y+40)));sceneView.mouseUp(with:event(.leftMouseUp,NSPoint(x:point.x,y:point.y+40)))
        precondition(workspace.config.containerDimensions.height != old.height,"3D 手柄未改变高度")
        precondition(workspace.allPieces().count==2 && workspace.dirty,"手柄改变丢失货物")
        undoContainerSize();precondition(workspace.config.containerDimensions.height==old.height,"手柄撤销未恢复")
        fputs("NATIVE_RESIZE_OK inline=true outside_to_pending=1 conserved=2 undo=true handle_drag=true no_auto_compute=true\n",stdout);NSApp.terminate(nil)
    }

    private func runDragSmoke() {
        var dto=workspace.bays[0].pieces[0].dto()
        dto.x=1000;dto.y=1000;dto.z=0;dto.l=600;dto.w=400;dto.h=300
        let piece=PieceModel(dto);workspace.bays[0].pieces=[piece];workspace.bays=[workspace.bays[0]];workspace.pending=[];workspace.dirty=false
        showBay(0);window?.contentView?.layoutSubtreeIfNeeded()
        let projected=sceneView.projectPoint(SCNVector3(1.3,0.15,1.2))
        let start=sceneView.convert(NSPoint(x:CGFloat(projected.x),y:CGFloat(projected.y)),to:nil)
        func event(_ type:NSEvent.EventType,_ point:NSPoint)->NSEvent {NSEvent.mouseEvent(with:type,location:point,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:window!.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:1)!}
        let hitPoint=sceneView.convert(start,from:nil)
        let hits=sceneView.hitTest(hitPoint,options:[.categoryBitMask:2,.searchMode:SCNHitTestSearchMode.closest.rawValue])
        fputs("DRAG_DIAG bounds=\(sceneView.bounds) projected=\(projected) window=\(start) hits=\(hits.map{$0.node.name ?? String(describing:type(of:$0.node))})\n",stderr)
        sceneView.mouseDown(with:event(.leftMouseDown,start))
        fputs("DRAG_PICKED \(sceneView.selectedPiece()?.id ?? "nil")\n",stderr)
        precondition(sceneView.selectedPiece()?.id==piece.id,"柜体外壳仍挡住货物拾取")
        sceneView.mouseUp(with:event(.leftMouseUp,start));precondition(!workspace.dirty,"仅点击就改动了方案")
        sceneView.mouseDown(with:event(.leftMouseDown,start))
        let end=NSPoint(x:start.x+35,y:start.y+12)
        sceneView.mouseDragged(with:event(.leftMouseDragged,end));sceneView.mouseUp(with:event(.leftMouseUp,end))
        fputs("DRAG_MOVED x=\(piece.x) y=\(piece.y) dirty=\(workspace.dirty) pending=\(workspace.pending.count)\n",stderr)
        precondition(piece.x != 1000 || piece.y != 1000,"拖拽未改变坐标")
        precondition(workspace.dirty && workspace.pending.isEmpty,"合法拖拽状态不正确")
        fputs("NATIVE_DRAG_SMOKE_OK picked_cargo=true moved=true click_preserved=true\n",stdout);NSApp.terminate(nil)
    }
    private func runFullEditorSmoke() {
        let piece=workspace.bays[0].pieces[0],height=(workspace.bays[0].pieces[0].cargo["dimensions"]?.object?["height"]?.number ?? 100)+10
        sceneView.select(piece.id);openFullEditor()
        var stage=0,attempt=0,inFlight=false
        Timer.scheduledTimer(withTimeInterval:0.4,repeats:true) {timer in
            if inFlight {return};attempt += 1
            if stage==1 && self.editorPanel==nil {
                precondition(piece.cargo["dimensions"]?.object?["height"]?.number==height && piece.kilograms==41 && piece.cargo["maxStackWeight"]?.number==123,"完整参数没有回写原生模型")
                precondition(self.workspace.pending.contains(where:{$0.id==piece.id}),"约束改动后没有进入待装池")
                timer.invalidate();fputs("NATIVE_EDITOR_ROUNDTRIP_OK height_changed=true weight=41 max_stack_weight=123 pending=true\n",stdout);NSApp.terminate(nil);return
            }
            if attempt>100 {fputs("FULL_EDITOR_SMOKE_TIMEOUT\n",stderr);self.editorWorkspace?.stop();exit(1)}
            guard stage==0,let web=self.editorWorkspace else{return};inFlight=true
            web.view.evaluateJavaScript("document.querySelector('input[aria-label=\"货物顶部承重\"]') !== null") {value,error in
                inFlight=false
                if value as? Bool == true {
                    stage=1
                    let code="const set=(label,value)=>{const input=document.querySelector('input[aria-label=\"'+label+'\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));};set('框体外包高','\(height)');set('编辑单件重量','41');set('货物顶部承重','123');true"
                    web.view.evaluateJavaScript(code) {_,_ in web.view.evaluateJavaScript("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保存更改').click();true",completionHandler:nil)}
                }
            }
        }
    }

    private var smokeIDs = Set<String>()
    private var smokePendingID = ""
    private func runInterfaceSmoke() {
        window?.contentView?.layoutSubtreeIfNeeded()
        precondition(sceneView.frame.width >= 600 && sceneView.frame.height >= 400, "SceneKit 视图被布局压缩")
        let pieces = Array(workspace.bays[0].pieces.prefix(7))
        workspace.bays[0].pieces = pieces
        workspace.bays = [workspace.bays[0]]; workspace.pending = []; workspace.seed = nil
        workspace.config.timeLimit = 3000
        showBay(0)
        let piece = pieces[0]
        sendToPending(piece)
        let button = NSButton(); button.identifier = NSUserInterfaceItemIdentifier(piece.id)
        focusPending(button)
        weightField.stringValue = "42"; nameField.stringValue = "原生待装编辑测试"
        applyParams()
        precondition(piece.kilograms == 42 && piece.name == "原生待装编辑测试", "待装池编辑未生效")
        heightField.stringValue = "nan"
        precondition(!commitEditor(), "非有限参数未拒绝")
        heightField.stringValue = "50000"; widthField.stringValue = "50000"; lengthField.stringValue = "50000"
        precondition(commitEditor(), "有效参数被拒绝")
        smokePendingID = piece.id
        smokeIDs = Set(workspace.allPieces().map(\.id))
        exitEdit()
        precondition(editedID == nil && !editing, "退出编辑未清空选择")
        recalculate()
        precondition(busy && sceneView.interactionLocked && !recalcButton.isEnabled, "计算期间未锁定编辑")
    }
    private func finishInterfaceSmoke() {
        let ids = workspace.allPieces().map(\.id)
        precondition(ids.count == smokeIDs.count && Set(ids) == smokeIDs, "重算丢件或重复")
        precondition(workspace.pending.contains(where: { $0.id == smokePendingID && $0.kilograms == 42 && $0.name == "原生待装编辑测试" && $0.height == 50000 }), "超限编辑件未保留在待装池")
        precondition(!busy && !sceneView.interactionLocked && recalcButton.isEnabled, "计算完成未解锁")
        fputs("ASSEMBLY_UI_SMOKE_OK edited_pending=1 conserved=7 async_repack=ok\n", stdout)
        NSApp.terminate(nil)
    }

    func applicationWillTerminate(_ notification: Notification) {
        autosaveTask?.cancel()
        if !isNativeCheck,let workspace {let snapshot=workspace.dto();autosaveQueue.sync{try? persistWorkspace(snapshot)}}
        computeCancellation?.cancel();RepackProcessSlot.shared.stop();floatingSupport?.stop();globePage?.stop();editorWorkspace?.stop();embeddedWorkspace.stop()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    private func buildWindow() {
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1500, height: 940), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "3D CargoPlan · 3D舱策 · 海陆运输作业智能体 · 1.7.2"
        window.minSize = NSSize(width: 1280, height: 880)
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = NSColor(srgbRed: 0.063, green: 0.090, blue: 0.122, alpha: 1)

        tabs.selectedSegment = 0
        tabs.target = self; tabs.action = #selector(changeTab)
        tabs.segmentStyle = .rounded
        tabs.font = .systemFont(ofSize:13,weight:.medium)
        tabs.controlSize = .large
        recalcButton.target = self; recalcButton.action = #selector(recalculate)
        recalcButton.bezelStyle = .rounded
        exitEditButton.target = self; exitEditButton.action = #selector(exitOrCancel)
        bayPicker.target = self; bayPicker.action = #selector(changeBay)
        progress.style = .bar;progress.isIndeterminate=false;progress.minValue=0;progress.maxValue=100;progress.isHidden=true
        computeMode.addItems(withTitles:["快速修复 · 优先保留当前方案","深度优化 · 重新搜索比较"]);computeMode.setAccessibilityLabel("装配计算模式")
        progressText.font = .systemFont(ofSize:11);progressText.textColor = .secondaryLabelColor

        pendingStack.orientation = .horizontal; pendingStack.spacing = 8; pendingStack.edgeInsets = NSEdgeInsets(top: 4, left: 4, bottom: 4, right: 4)
        pendingStrip.documentView = pendingStack
        pendingStrip.hasHorizontalScroller = true; pendingStrip.hasVerticalScroller = false
        pendingStrip.drawsBackground = false; pendingStrip.borderType = .noBorder
        pendingStrip.heightAnchor.constraint(equalToConstant: 44).isActive = true

        assemblyActions = NSStackView(views: [pendingStrip, recalcButton, exitEditButton]); assemblyActions.spacing = 10
        let brand = NSTextField(labelWithString: "CARGOPLAN")
        brand.font = .systemFont(ofSize: 14, weight: .semibold); brand.textColor = .labelColor
        recalcButton.contentTintColor = .systemBlue
        catalogButton.target=self;catalogButton.action=#selector(showKnowledgeCatalog);catalogButton.isHidden=true
        let top = NSStackView(views: [brand, tabs, NSView(), catalogButton, assemblyActions])
        top.orientation = .horizontal; top.spacing = 12; top.alignment = .centerY
        top.edgeInsets = NSEdgeInsets(top: 10, left: 14, bottom: 10, right: 14)
        NSLayoutConstraint.activate([
            tabs.widthAnchor.constraint(greaterThanOrEqualToConstant: 360),
            pendingStrip.widthAnchor.constraint(greaterThanOrEqualToConstant: 200)
        ])

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("name")); column.title = "货物"
        table.addTableColumn(column); table.headerView = nil; table.dataSource = self; table.delegate = self; table.rowHeight = 30
        table.style = .sourceList
        table.intercellSpacing = NSSize(width:8,height:4)
        let scroll = NSScrollView(); scroll.documentView = table; scroll.hasVerticalScroller = true; scroll.drawsBackground = false

        configureField(nameField, placeholder: "名称")
        configureField(lengthField, placeholder: "长 mm"); configureField(widthField, placeholder: "宽 mm")
        configureField(heightField, placeholder: "高 mm"); configureField(weightField, placeholder: "重量 kg")
        let advanced=NSButton(title:"完整参数 · 方向 / 承重 / 空腔",target:self,action:#selector(openFullEditor))
        let apply = NSButton(title: "应用参数", target: self, action: #selector(applyParams))
        let toPool = NSButton(title: "移入待装池", target: self, action: #selector(moveSelectedToPool))
        editorBox.orientation = .vertical; editorBox.spacing = 8; editorBox.alignment = .leading
        let dimRow = NSStackView(views: [labeled("长", lengthField), labeled("宽", widthField), labeled("高", heightField)])
        dimRow.distribution = .fillEqually
        editorBox.setViews([
            NSTextField(labelWithString: "选中件参数 · 修改后主动重新计算"),
            advanced,
            labeled("名称", nameField),
            dimRow,
            labeled("重量 kg", weightField),
            NSStackView(views: [apply, toPool])
        ], in: .leading)
        editorBox.isHidden = true

        status.maximumNumberOfLines = 10
        let imports=NSButton(title:"导入 Excel",target:self,action:#selector(importWorkbook))
        let template=NSButton(title:"下载模板",target:self,action:#selector(saveTemplate))
        let export=NSButton(title:"导出方案",target:self,action:#selector(exportWorkbook))
        let files=NSStackView(views:[imports,template,export]);files.spacing=6
        let vehicle=NSButton(title:"载重与留缝…",target:self,action:#selector(editVehicle))
        for (field,label) in [(cargoLength,"货舱内长 mm"),(cargoWidth,"货舱内宽 mm"),(cargoHeight,"货舱内高 mm")] {configureField(field,placeholder:label);field.setAccessibilityLabel(label)}
        let sizeRow=NSStackView(views:[labeled("内长 mm",cargoLength),labeled("内宽 mm",cargoWidth),labeled("内高 mm",cargoHeight)]);sizeRow.distribution = .fillEqually;sizeRow.spacing=6
        let applySize=NSButton(title:"应用货舱尺寸",target:self,action:#selector(applyContainerSize))
        undoResize.target=self;undoResize.action=#selector(undoContainerSize)
        resizeToggle.target=self;resizeToggle.action=#selector(toggleContainerResize);resizeToggle.font = .systemFont(ofSize:12)
        let sizeActions=NSStackView(views:[applySize,undoResize,vehicle]);sizeActions.spacing=5
        let sizeEditor=NSStackView(views:[NSTextField(labelWithString:"货舱尺寸 · 应用到全部货舱"),sizeRow,sizeActions,resizeToggle]);sizeEditor.orientation = .vertical;sizeEditor.alignment = .leading;sizeEditor.spacing=8
        fileButtons=[imports,template,export,vehicle,applySize,undoResize,resizeToggle]
        let help=NSTextField(wrappingLabelWithString:"点击或拖动货物进行编辑；Option 拖动调高。尺寸与约束可在「完整参数」中修改。")
        help.font = .systemFont(ofSize:11);help.textColor = .secondaryLabelColor
        vehicleSpec.font = .systemFont(ofSize:11);vehicleSpec.textColor = .secondaryLabelColor
        let computeBox=NSStackView(views:[computeMode,progress,progressText]);computeBox.orientation = .vertical;computeBox.alignment = .leading;computeBox.spacing=6
        let sideStack = NSStackView(views: [files,sizeEditor,vehicleSpec,computeBox,bayPicker,help,editorBox,scroll,status])
        sideStack.orientation = .vertical; sideStack.spacing = 10; sideStack.alignment = .leading; sideStack.edgeInsets = NSEdgeInsets(top: 12, left: 12, bottom: 12, right: 12)
        sideStack.translatesAutoresizingMaskIntoConstraints = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        let document=InspectorDocument();document.translatesAutoresizingMaskIntoConstraints=false;document.addSubview(sideStack)
        let side=NSScrollView();side.documentView=document;side.hasVerticalScroller=true;side.drawsBackground=false
        NSLayoutConstraint.activate([
            document.widthAnchor.constraint(equalTo:side.contentView.widthAnchor),
            document.heightAnchor.constraint(greaterThanOrEqualTo:side.contentView.heightAnchor),
            sideStack.leadingAnchor.constraint(equalTo: document.leadingAnchor),
            sideStack.trailingAnchor.constraint(equalTo: document.trailingAnchor),
            sideStack.topAnchor.constraint(equalTo: document.topAnchor),
            sideStack.bottomAnchor.constraint(equalTo: document.bottomAnchor),
            scroll.heightAnchor.constraint(equalToConstant:230),
            computeBox.widthAnchor.constraint(equalTo:sideStack.widthAnchor,constant:-24),
            computeMode.widthAnchor.constraint(equalTo:computeBox.widthAnchor),
            progress.widthAnchor.constraint(equalTo:computeBox.widthAnchor),
            progressText.widthAnchor.constraint(equalTo:computeBox.widthAnchor),
            bayPicker.widthAnchor.constraint(equalTo: sideStack.widthAnchor, constant: -24),
            sizeEditor.widthAnchor.constraint(equalTo:sideStack.widthAnchor,constant:-24),
            sizeRow.widthAnchor.constraint(equalTo:sizeEditor.widthAnchor),
            scroll.widthAnchor.constraint(equalTo: sideStack.widthAnchor, constant: -24),
            vehicleSpec.widthAnchor.constraint(equalTo: sideStack.widthAnchor, constant: -24),
            help.widthAnchor.constraint(equalTo: sideStack.widthAnchor, constant: -24),
            status.widthAnchor.constraint(equalTo: sideStack.widthAnchor, constant: -24)
        ])

        let split = NSSplitView(); split.isVertical = true; split.dividerStyle = .thin
        split.addArrangedSubview(side); split.addArrangedSubview(sceneView)
        side.widthAnchor.constraint(equalToConstant: 340).isActive = true

        assemblyPage = split
        installPage(split)
        let root = NSStackView(views: [top, workspaceHost])
        root.orientation = .vertical; root.alignment = .leading; root.spacing = 0; root.translatesAutoresizingMaskIntoConstraints = false
        let content = NSView(); content.addSubview(root)
        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            root.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            root.topAnchor.constraint(equalTo: content.topAnchor),
            root.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            top.heightAnchor.constraint(equalToConstant: 64),
            top.widthAnchor.constraint(equalTo: root.widthAnchor),
            workspaceHost.widthAnchor.constraint(equalTo: root.widthAnchor),
            workspaceHost.heightAnchor.constraint(equalTo:root.heightAnchor,constant:-64),
            sceneView.widthAnchor.constraint(greaterThanOrEqualToConstant: 600)
        ])
        window.contentView = content
        floatingSupport=FloatingSupport(host:content,service:embeddedWorkspace)
        updateSupportContext()
        window.center(); window.makeKeyAndOrderFront(nil)
        self.window = window

        sceneView.onResizePreview = { [weak self] d in self?.setContainerFields(d) }
        sceneView.onResizeCommitted = { [weak self] d in self?.applyContainerDimensions(d) }
        setContainerFields(workspace.config.containerDimensions)
        sceneView.onSelection = { [weak self] id in guard let self,!self.suppress else{return};self.beginEdit(id) }
        sceneView.onMoved = { [weak self] in self?.workspace.dirty = true; self?.vehicleUndo=nil; self?.refreshChrome() }
        sceneView.onInvalidDrop = { [weak self] piece in self?.sendToPending(piece) }
    }

    private func configureField(_ field: NSTextField, placeholder: String) {
        field.placeholderString = placeholder
        field.delegate = self
        field.isEditable = true
        field.isBordered = true
        field.bezelStyle = .roundedBezel
        field.font = .systemFont(ofSize:13)
        field.controlSize = .large
    }
    private func labeled(_ title: String, _ field: NSTextField) -> NSView {
        let stack = NSStackView(views: [NSTextField(labelWithString: title), field])
        stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 2
        field.widthAnchor.constraint(greaterThanOrEqualToConstant: 90).isActive = true
        return stack
    }

    private func showBay(_ index: Int,preserveCamera:Bool=false) {
        guard workspace.bays.indices.contains(index) else { return }
        bayIndex = index
        updatingPicker = true
        if bayPicker.numberOfItems != workspace.bays.count {
            bayPicker.removeAllItems()
            for bay in workspace.bays { bayPicker.addItem(withTitle: "\(bay.title) · \(bay.pieces.count) 件") }
        }
        bayPicker.selectItem(at: index)
        updatingPicker = false
        sceneView.show(workspace.bays[index],preserveCamera:preserveCamera)
        table.reloadData()
        exitEdit()
        refreshChrome()
    }

    private func refreshChrome() {
        if bayPicker.numberOfItems==workspace.bays.count {
            for (index,bay) in workspace.bays.enumerated(){bayPicker.item(at:index)?.title="\(bay.title) · \(bay.pieces.count) 件"}
        }
        if !isNativeCheck,!busy {
            autosaveTask?.cancel()
            let task=DispatchWorkItem{ [weak self] in guard let self else{return};let snapshot=self.workspace.dto();self.autosaveQueue.async{do{try persistWorkspace(snapshot)}catch{fputs("WORKSPACE_SAVE_FAILED: \(error)\n",stderr)}} }
            autosaveTask=task;DispatchQueue.main.asyncAfter(deadline:.now()+0.7,execute:task)
        }
        let d=workspace.config.containerDimensions
        vehicleSpec.stringValue="货舱 \(fmt(d.length)) × \(fmt(d.width)) × \(fmt(d.height)) mm\n限重 \(fmt(workspace.config.containerMaxWeight)) kg · 总货物 \(workspace.allPieces().count) 件"
        pendingStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        if workspace.pending.isEmpty {
            let empty = NSTextField(labelWithString: "待装池为空")
            empty.textColor = .secondaryLabelColor
            pendingStack.addArrangedSubview(empty)
        } else {
            for piece in workspace.pending {
                let button = NSButton(title: piece.name, target: self, action: #selector(focusPending(_:)))
                button.identifier = NSUserInterfaceItemIdentifier(piece.id)
                button.bezelStyle = .rounded
                pendingStack.addArrangedSubview(button)
            }

        }
        pendingStack.setFrameSize(NSSize(width: max(1, pendingStack.fittingSize.width), height: 44))
        fileButtons.forEach{$0.isEnabled = !busy}
        undoResize.isEnabled = vehicleUndo != nil && !busy
        for f in [cargoLength,cargoWidth,cargoHeight]{f.isEnabled = !busy}
        recalcButton.isEnabled = !busy;computeMode.isEnabled = !busy
        sceneView.interactionLocked = busy
        table.isEnabled = !busy; bayPicker.isEnabled = !busy; tabs.isEnabled = !busy
        for field in [nameField, lengthField, widthField, heightField, weightField] { field.isEnabled = !busy }
        for view in pendingStack.arrangedSubviews { (view as? NSButton)?.isEnabled = !busy }
        for view in editorBox.arrangedSubviews { (view as? NSButton)?.isEnabled = !busy; if let row = view as? NSStackView { for child in row.arrangedSubviews { (child as? NSButton)?.isEnabled = !busy } } }
        exitEditButton.isEnabled = computeToken != nil || editing && !busy
        exitEditButton.title = computeToken != nil ? "取消计算" : editing ? "退出编辑" : "未在编辑"
        let bay = workspace.bays[bayIndex]
        let overlap = sceneView.overlapCount()
        if let piece = sceneView.selectedPiece() {
            status.stringValue = "编辑中：\(piece.name)\n坐标 \(fmt(piece.x)) / \(fmt(piece.y)) / \(fmt(piece.z)) mm\n待装 \(workspace.pending.count) 件 · \(workspace.dirty ? "有未重算改动" : "与当前方案一致")"
        } else {
            status.stringValue = "\(bay.title) · 柜内 \(bay.pieces.count) 件\n待装池 \(workspace.pending.count) 件\n\(overlap == 0 ? "外包包围盒无交叠" : "外包交叠 \(overlap) 件（含空腔，非实体验证）")\n\(workspace.summary)"
        }
    }

    private func beginEdit(_ id: String?) {
        editedID = id
        guard let id, let piece = workspace.bays[bayIndex].pieces.first(where: { $0.id == id }) ?? workspace.pending.first(where: { $0.id == id }) else {
            editing = false; editorBox.isHidden = true; refreshChrome(); return
        }
        editing = true; editorBox.isHidden = false
        nameField.stringValue = piece.name
        let dims = piece.cargo["dimensions"]?.object
        lengthField.stringValue = String(dims?["length"]?.number ?? piece.length)
        widthField.stringValue = String(dims?["width"]?.number ?? piece.width)
        heightField.stringValue = String(dims?["height"]?.number ?? piece.height)
        weightField.stringValue = String(piece.kilograms)
        if let row = workspace.bays[bayIndex].pieces.firstIndex(where: { $0.id == id }) {
            suppress = true; table.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false); table.scrollRowToVisible(row); suppress = false
        }
        refreshChrome()
    }

    private func sendToPending(_ piece: PieceModel) {
        vehicleUndo=nil
        editedID = nil
        workspace.enqueuePending(piece)
        sceneView.removePiece(piece.id)
        editing = false; editorBox.isHidden = true
        table.reloadData()
        refreshChrome()
    }

    @objc private func moveSelectedToPool() {
        guard let piece = sceneView.selectedPiece() else { return }
        sendToPending(piece)
    }

    @objc private func applyParams() { _ = commitEditor() }
    @discardableResult private func commitEditor(keepEditing:Bool=false) -> Bool {
        if busy { return false }
        guard let id = editedID, let piece = workspace.allPieces().first(where: { $0.id == id }) else { return true }
        guard let length = Double(lengthField.stringValue), let width = Double(widthField.stringValue), let height = Double(heightField.stringValue), let weight = Double(weightField.stringValue),
              [length,width,height,weight].allSatisfy({ $0.isFinite }), length > 0, width > 0, height > 0, weight >= 0 else {
            status.stringValue = "参数无效：长宽高须为有限正数，重量须为有限非负数。"
            return false
        }
        let dimensions = piece.cargo["dimensions"]?.object
        let resized = length != dimensions?["length"]?.number || width != dimensions?["width"]?.number || height != dimensions?["height"]?.number
        let name = nameField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let nextName=name.isEmpty ? piece.name:name
        if !resized && nextName==piece.name && weight==piece.kilograms{return true}
        vehicleUndo=nil
        piece.name = nextName; piece.kilograms = weight
        // Raw dimensions are not necessarily the placed orientation. Resized pieces await the solver.
        if resized {
            piece.applySourceDimensions(length:length,width:width,height:height)
            if keepEditing {workspace.enqueuePending(piece);suppress=true;sceneView.removePiece(piece.id);suppress=false}else{sendToPending(piece)}
            workspace.summary="已保存 \(piece.name) 的尺寸，转入待装池等待主动重新计算。"
        }
        workspace.dirty = true
        refreshChrome(); table.reloadData()
        return true
    }

    @objc private func exitEdit() {
        editedID = nil
        editing = false
        editorBox.isHidden = true
        sceneView.select(nil)
        table.deselectAll(nil)
        refreshChrome()
    }

    @objc private func changeBay() {
        if updatingPicker { return }
        showBay(bayPicker.indexOfSelectedItem)
    }

    private func installPage(_ view: NSView) {
        if view.superview !== workspaceHost {
            view.translatesAutoresizingMaskIntoConstraints = false; workspaceHost.addSubview(view)
            NSLayoutConstraint.activate([view.leadingAnchor.constraint(equalTo: workspaceHost.leadingAnchor),view.trailingAnchor.constraint(equalTo: workspaceHost.trailingAnchor),view.topAnchor.constraint(equalTo: workspaceHost.topAnchor),view.bottomAnchor.constraint(equalTo: workspaceHost.bottomAnchor)])
        }
        workspaceHost.subviews.forEach { $0.isHidden = $0 !== view }
    }
    @objc private func showKnowledgeCatalog() {
        embeddedWorkspace.setSupportContext(workspace:"ports",portCode:supportPort)
        installPage(embeddedWorkspace.view);embeddedWorkspace.show("ports")
    }
    private func updateSupportContext(){
        floatingSupport.setAvailable(tabs.selectedSegment==2)
        floatingSupport.setContext(workspace:"ports",portCode:supportPort)
    }
    private func handleWorkspaceMessage(_ message:[String:Any]) {
        switch message["type"] as? String {
        case "navigate":
            guard let target=message["workspace"] as? String,let index=["demo":1,"ports":2][target] else{return}
            tabs.selectedSegment=index;assemblyActions.isHidden=true;catalogButton.isHidden=index != 2;updateSupportContext()
        case "port-selected":
            if let code=message["portCode"] as? String {supportPort=code;updateSupportContext();if globePage?.selectedCode != code {globePage?.selectPort(code)}}
        case "assistant-open":
            guard tabs.selectedSegment==2 else{return}
            if let code=message["portCode"] as? String {supportPort=code}
            updateSupportContext();floatingSupport.show()
        default:break
        }
    }
    @objc private func changeTab() {
        guard !busy else { return }
        assemblyActions.isHidden = tabs.selectedSegment != 0
        catalogButton.isHidden = tabs.selectedSegment != 2
        updateSupportContext()
        switch tabs.selectedSegment {
        case 0: installPage(assemblyPage)
        case 2:
            if globePage == nil {
                globePage=NativeGlobePanel(frame:.zero,service:embeddedWorkspace)
                globePage?.onSelection={ [weak self] code in self?.supportPort=code;self?.updateSupportContext() }
                globePage?.onMessage={ [weak self] message in self?.handleWorkspaceMessage(message) }
            }
            supportPort=globePage?.selectedCode;updateSupportContext()
            installPage(globePage!)
        default:
            installPage(embeddedWorkspace.view)
            embeddedWorkspace.setContext(workspace.dto(), bayIndex: bayIndex, dirty: workspace.dirty)
            embeddedWorkspace.show("demo")
        }
    }
    private func runSupportSmoke() {
        tabs.selectedSegment=2;changeTab();globePage?.selectPort("CNTXG");floatingSupport.show()
        var stage=0,attempts=0,inFlight=false
        let queries=[
            "document.querySelector('.support-header h2')?.textContent==='3D CargoPlan 助手' && document.querySelector('.support-context')?.textContent.includes('CNTXG')===true",
            "document.querySelector('.chat-answer')?.textContent.includes('津环车')===true"
        ]
        let timer=Timer.scheduledTimer(withTimeInterval:0.4,repeats:true) { timer in
            if inFlight{return};inFlight=true
            self.floatingSupport.web.view.evaluateJavaScript(queries[stage]) { value,error in
                inFlight=false;attempts+=1
                if value as? Bool == true {
                    if stage==0 {
                        self.floatingSupport.web.view.evaluateJavaScript("Array.from(document.querySelectorAll('.chat-suggestions button')).find(b=>b.textContent.includes('限行')).click();true",completionHandler:nil)
                        stage=1;attempts=0
                    } else {
                        timer.invalidate();self.tabs.selectedSegment=0;self.changeTab()
                        precondition(self.floatingSupport.button.isHidden && self.floatingSupport.panel.isHidden,"港口助手不应出现在装配页面")
                        fputs("NATIVE_SUPPORT_SMOKE_OK ports_only=true local_tianjin=true\n",stdout);NSApp.terminate(nil)
                    }
                } else if attempts>75 {timer.invalidate();fputs("PORT_SUPPORT_SMOKE_FAILED\n",stderr);self.embeddedWorkspace.stop();exit(1)}
            }
        }
        RunLoop.main.add(timer,forMode:.common)
    }
    private var shellChecks = 0
    private func runManualRouteSmoke(sideVehicle:Bool=false) {
        tabs.selectedSegment=1;changeTab()
        var stage=0,attempts=0,inFlight=false
        let timer=Timer.scheduledTimer(withTimeInterval:0.4,repeats:true) { timer in
            if inFlight{return};inFlight=true
            var queries=[
                "document.querySelector('select[aria-label=\"起点载货\"]') !== null",
                "document.querySelector('.route-problem-summary')?.textContent.includes('起点 0 件') === true",
                "document.querySelector('input[aria-label=\"取货名称\"]')?.value==='手工测试箱'",
                "document.querySelector('input[aria-label=\"取货数量\"]')?.value==='2'",
                "document.querySelector('select[aria-label=\"取货交付站\"]')?.value==='1'",
                "document.querySelector('.route-problem-summary')?.textContent.includes('装货 2 件') === true",
                "document.querySelector('.route-problem-summary')?.textContent.includes('4 个站点') === true",
                "document.querySelector('.route-test-status.complete')?.textContent.includes('4 站全部任务完成') === true"
            ]
            if sideVehicle {queries.insert("document.querySelector('input[aria-label=\"车辆内长\"]')?.value==='13000'",at:2)}
            self.embeddedWorkspace.view.evaluateJavaScript(queries[stage]) { value,error in
                inFlight=false;attempts+=1
                if value as? Bool == true {
                    var actions=[
                        "const s=document.querySelector('select[aria-label=\"起点载货\"]');s.value='empty';s.dispatchEvent(new Event('change',{bubbles:true}));",
                        "const e=document.querySelector('input[aria-label=\"取货名称\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'手工测试箱');e.dispatchEvent(new Event('input',{bubbles:true}));",
                        "const e=document.querySelector('input[aria-label=\"取货数量\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2');e.dispatchEvent(new Event('input',{bubbles:true}));",
                        "const s=document.querySelector('select[aria-label=\"取货交付站\"]');s.value='1';s.dispatchEvent(new Event('change',{bubbles:true}));",
                        "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('加入本站装货清单')).click();",
                        "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('添加站点')).click();",
                        "Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='计算装卸方案').click();"
                    ]
                    if sideVehicle {actions.insert("const s=document.querySelector('select[aria-label=\"选择车型\"]');s.value='curtain-13';s.dispatchEvent(new Event('change',{bubbles:true}));",at:1)}
                    if stage<actions.count { self.embeddedWorkspace.view.evaluateJavaScript("(()=>{"+actions[stage]+"return true})()",completionHandler:nil);stage+=1 }
                    else {
                        let check=sideVehicle ? "document.body.innerText.includes('设备抽取') && document.body.innerText.includes('左侧') && document.querySelector('.route-problem-summary').textContent.includes('13000 × 2450 × 2600')" : "document.body.innerText.includes('通道 600 mm') && getComputedStyle(document.querySelector('.route-workbench')).fontFamily.includes('-apple-system') && getComputedStyle(document.querySelector('.route-workbench')).backgroundColor==='rgb(21, 30, 40)' && document.querySelector('.route-problem-summary').textContent.includes('11600 × 2250 × 2500')"
                        self.embeddedWorkspace.view.evaluateJavaScript(check) { ok,_ in
                            timer.invalidate()
                            guard ok as? Bool == true else{fputs("MANUAL_ROUTE_STYLE_FAILED\n",stderr);exit(1)}
                            fputs(sideVehicle ? "NATIVE_VEHICLE_ROUTE_OK preset=curtain-13 dimensions=13000x2450x2600 side_access=true stops=4 audit=valid\n":"NATIVE_MANUAL_ROUTE_OK source=empty manual_pickups=2 destinations=assigned stops=4 human_access=true audit=valid explicit_calculation=true\n",stdout)
                            NSApp.terminate(nil)
                        }
                    }
                } else if attempts>130 {
                    timer.invalidate();self.embeddedWorkspace.view.evaluateJavaScript("document.body.innerText.slice(0,8000)") { body,_ in fputs("MANUAL_ROUTE_FAILED stage=\(stage) body=\(body ?? "empty") error=\(String(describing:error))\n",stderr);self.embeddedWorkspace.stop();exit(1) }
                }
            }
        }
        RunLoop.main.add(timer,forMode:.common)
    }
    private func runRouteDemoSmoke() {
        for piece in Array(workspace.bays[0].pieces.prefix(5)) { workspace.enqueuePending(piece) }
        refreshChrome()
        let encoder=JSONEncoder();encoder.outputFormatting = .sortedKeys
        let before=try! encoder.encode(workspace.dto())
        tabs.selectedSegment=1;changeTab()
        let scripts=[
            "document.querySelector('[data-action=route-demo]')?.disabled===false && document.querySelector('.route-calculate')?.disabled===true && document.body.innerText.includes('装配有未重算修改')",
            "document.querySelector('.route-random')?.getBoundingClientRect().height>0 && document.querySelector('select[aria-label=\"出题数据来源\"]')?.value==='iraq' && document.querySelector('select[aria-label=\"伊拉克基线货柜\"]')?.options.length===11 && Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='生成题目')?.disabled===false",
            "document.querySelector('.route-problem-summary')?.dataset.planSource==='iraq' && document.querySelector('.route-problem-summary')?.textContent.includes('起点 93 件') && document.querySelector('.route-calculate')?.disabled===false",
            "document.querySelector('.route-test-status.complete')?.textContent.includes('5 站全部任务完成')===true && document.querySelector('.route-player canvas')!==null",
            "Number(document.querySelector('.route-player-viewport')?.dataset.step)>=0 && Number(document.querySelector('.route-player-viewport')?.dataset.phase)>0 && document.querySelector('.route-player-viewport')?.dataset.movingX!==''",
            "document.querySelector('.route-random')?.getBoundingClientRect().top>=0 && document.querySelector('.route-random')?.getBoundingClientRect().top<innerHeight/2 && document.querySelector('.route-problem-summary')?.dataset.planSource==='iraq' && document.querySelector('.route-demo-settings-toggle')?.getAttribute('aria-expanded')==='true'"
        ]
        let actions=[
            "document.querySelector('.route-demo-settings-toggle').click()",
            "Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='生成题目').click()",
            "document.querySelector('.route-calculate').click()",
            "Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='播放全程').click()",
            "document.querySelector('.route-demo-settings-toggle').click()"
        ]
        var stage=0,attempts=0,inFlight=false
        let timer=Timer.scheduledTimer(withTimeInterval:0.4,repeats:true) { timer in
            if inFlight{return};inFlight=true
            self.embeddedWorkspace.view.evaluateJavaScript(scripts[stage]) { value,error in
                inFlight=false;attempts+=1
                if value as? Bool == true {
                    if stage<actions.count {
                        if stage==2 {
                            self.embeddedWorkspace.setContext(self.workspace.dto(),bayIndex:0,dirty:false)
                            self.embeddedWorkspace.setContext(self.workspace.dto(),bayIndex:0,dirty:true)
                        }
                        self.embeddedWorkspace.view.evaluateJavaScript("(()=>{"+actions[stage]+";return true})()",completionHandler:nil)
                        stage+=1;attempts=0
                    } else {
                        timer.invalidate()
                        precondition((try! encoder.encode(self.workspace.dto()))==before,"独立演示改变了原生装配")
                        precondition(self.workspace.pending.count==5 && self.workspace.dirty,"演示丢失待装状态")
                        fputs("NATIVE_ROUTE_DEMO_OK visible_entry=true dirty_assembly_allowed=true pending_preserved=5 source=html_iraq_baseline cabinets=11 catalog=1371 initial_inventory=93 stops=5 audit=valid animation=moving context_refresh=preserved return_to_generator=visible\n",stdout)
                        NSApp.terminate(nil)
                    }
                } else if attempts>100 {
                    timer.invalidate();self.embeddedWorkspace.view.evaluateJavaScript("document.body.innerText.slice(0,5000)") { body,_ in
                        fputs("ROUTE_DEMO_FAILED stage=\(stage) body=\(body ?? "empty") error=\(String(describing:error))\n",stderr);self.embeddedWorkspace.stop();exit(1)
                    }
                }
            }
        }
        RunLoop.main.add(timer,forMode:.common)
    }
    private func runShellSmoke() {
        let identity=workspace
        tabs.selectedSegment=2;changeTab()
        precondition(globePage != nil && assemblyPage.isHidden,"地球工作区未内部切换")
        showKnowledgeCatalog()
        var attempts=0,inFlight=false
        let timer=Timer.scheduledTimer(withTimeInterval:0.5,repeats:true) { timer in
            if inFlight{return};inFlight=true
            self.embeddedWorkspace.view.evaluateJavaScript("document.querySelector('#atlas-search-input')!==null && document.body.innerText.includes('11,835')") { value,error in
                inFlight=false;attempts+=1
                if value as? Bool == true {
                    timer.invalidate();self.tabs.selectedSegment=0;self.changeTab()
                    precondition(self.workspace === identity && !self.assemblyPage.isHidden,"切换丢失装配工作区")
                    precondition(self.tabs.segmentCount==3 && self.floatingSupport.button.isHidden,"工作区数量或港口助手范围错误")
                    fputs("NATIVE_SHELL_SMOKE_OK tabs=3 knowledge_catalog=true preserved=true ports_helper_only=true\n",stdout);NSApp.terminate(nil)
                } else if attempts>120 {timer.invalidate();self.embeddedWorkspace.stop();exit(1)}
            }
        }
        RunLoop.main.add(timer,forMode:.common)
    }
    @objc private func openFullEditor() {
        guard !busy,let id=editedID,let piece=workspace.allPieces().first(where:{$0.id==id}),let window else{return}
        editorTargetID=id
        let web=WorkspaceWeb();web.nativeMode="cargo-editor";web.useService(from:embeddedWorkspace)
        web.setCargoEditor(piece.cargoPayload(),count:workspace.allPieces().filter{nativeBatchKey($0)==nativeBatchKey(piece)}.count)
        web.onMessage = { [weak self] message in
            guard let self else{return}
            if message["type"] as? String == "cancelEditor" {self.closeFullEditor();return}
            guard message["type"] as? String == "saveCargo",let raw=message["item"] as? [String:Any] else{return}
            do {
                let cargo=try JSONDecoder().decode([String:JSONValue].self,from:JSONSerialization.data(withJSONObject:raw))
                try self.applyFullCargo(cargo,batch:message["batch"] as? Bool ?? false)
                self.closeFullEditor()
            } catch {NSAlert(error:error).runModal()}
        }
        let panel=NSPanel(contentRect:NSRect(x:0,y:0,width:760,height:820),styleMask:[.titled,.closable,.resizable],backing:.buffered,defer:false)
        panel.title="完整货物参数 · \(piece.name)";panel.appearance=NSAppearance(named:.darkAqua);panel.contentView=web.view
        panel.standardWindowButton(.closeButton)?.target=self;panel.standardWindowButton(.closeButton)?.action=#selector(closeFullEditor)
        editorWorkspace=web;editorPanel=panel;window.beginSheet(panel);web.show("editor")
    }
    @objc private func closeFullEditor() {
        if let panel=editorPanel {window?.endSheet(panel);panel.orderOut(nil)}
        editorWorkspace?.stop();editorWorkspace=nil;editorPanel=nil;editorTargetID=nil
    }
    private func applyFullCargo(_ cargo:[String:JSONValue],batch:Bool) throws {
        guard let id=editorTargetID,let original=workspace.allPieces().first(where:{$0.id==id}) else {throw CheckError("选中货物已变化，请重新打开编辑器")}
        _ = try pieceFromCargo(cargo)
        vehicleUndo=nil
        let targets=workspace.allPieces().filter{$0.id==id || batch && nativeBatchKey($0)==nativeBatchKey(original)}
        for piece in targets {
            var value=cargo;value["id"] = .string(piece.id);value["rawData"]=piece.cargo["rawData"]
            let updated=try pieceFromCargo(value)
            piece.cargo=value;piece.name=updated.name;piece.category=updated.category;piece.kilograms=updated.kilograms;piece.glass=updated.glass
            piece.applySourceDimensions(length:updated.length,width:updated.width,height:updated.height)
            workspace.enqueuePending(piece)
        }
        showBay(bayIndex);workspace.summary="已应用 \(targets.count) 件完整参数，进入待装池等待重新计算。";refreshChrome()
    }
    func control(_ control:NSControl,textView:NSTextView,doCommandBy commandSelector:Selector)->Bool {
        if [cargoLength,cargoWidth,cargoHeight].contains(where:{$0 === control}) && commandSelector == #selector(NSResponder.insertNewline(_:)) {applyContainerSize();return true}
        if [lengthField,widthField,heightField,weightField].contains(where:{$0 === control}) && commandSelector == #selector(NSResponder.insertNewline(_:)) {_=commitEditor(keepEditing:true);return true}
        return false
    }
    func controlTextDidEndEditing(_ notification:Notification){
        guard !busy,!suppress,let field=notification.object as? NSTextField else{return}
        if [cargoLength,cargoWidth,cargoHeight].contains(where:{$0 === field}){applyContainerSize()}
        else if editing && [lengthField,widthField,heightField,weightField].contains(where:{$0 === field}){_=commitEditor(keepEditing:true)}
    }
    private func setContainerFields(_ d:DimsDTO) {cargoLength.stringValue=String(d.length);cargoWidth.stringValue=String(d.width);cargoHeight.stringValue=String(d.height)}
    @objc private func applyContainerSize() {
        guard let l=Double(cargoLength.stringValue),let w=Double(cargoWidth.stringValue),let h=Double(cargoHeight.stringValue) else{status.stringValue="请输入有效的货舱内尺寸（mm）。";return}
        applyContainerDimensions(DimsDTO(length:l,width:w,height:h))
    }
    @objc private func toggleContainerResize() {
        guard !busy else{return}
        if editing && !commitEditor(){resizeToggle.state = .off;return}
        exitEdit();sceneView.resizingContainer=resizeToggle.state == .on
        status.stringValue=sceneView.resizingContainer ? "拖动蓝 / 绿 / 橙手柄调整长 / 宽 / 高；松手应用，Esc 取消。本操作不自动重算。":"已退出货舱调整，可继续拖动货物。"
    }
    private func applyContainerDimensions(_ d:DimsDTO,maxWeight:Double?=nil,gap:Double?=nil) {
        guard !busy else{return}
        guard [d.length,d.width,d.height].allSatisfy({$0.isFinite && $0>=100 && $0<=50000}) else{status.stringValue="内长 / 宽 / 高须在 100–50000 mm。";setContainerFields(workspace.config.containerDimensions);sceneView.show(workspace.bays[bayIndex],preserveCamera:true);return}
        let old=workspace.config.containerDimensions,oldGap=workspace.config.clearanceMm ?? (workspace.config.loadingProfile=="villa-pdf" ? 5:0)
        if d.length==old.length && d.width==old.width && d.height==old.height && (maxWeight ?? workspace.config.containerMaxWeight)==workspace.config.containerMaxWeight && (gap ?? oldGap)==oldGap {setContainerFields(old);status.stringValue="货舱规格未变化。";return}
        if editing && !commitEditor(){return}
        vehicleUndo=(workspace.dto(),workspace.dirty)
        workspace.config.containerDimensions=d
        if let maxWeight {workspace.config.containerMaxWeight=maxWeight}
        let keepProject=workspace.config.loadingProfile=="villa-pdf" && d.height==old.height && (gap ?? oldGap)==oldGap
        if !keepProject {workspace.config.loadingProfile="custom";workspace.config.verticalSupport=nil;workspace.config.supportCriterion=nil;workspace.config.offsetStackScope=nil}
        workspace.config.clearanceMm=keepProject ? nil:(gap ?? oldGap)
        var exceptions:[String:Double]=[:]
        if keepProject,case .array(let containers)=workspace.seed?["containers"] ?? .null {
            for container in containers {for (id,value) in container.object?["loadingRules"]?.object?["heightExceptions"]?.object ?? [:] {exceptions[id]=value.number}}
        }
        var moved=0
        for bay in workspace.bays {
            bay.length=d.length;bay.width=d.width;bay.height=d.height;bay.maxWeight=workspace.config.containerMaxWeight
            var weight=0.0
            for piece in Array(bay.pieces) {
                let outside=piece.x<0 || piece.y<0 || piece.z<0 || piece.x+piece.length>d.length+0.01 || piece.y+piece.width>d.width+0.01 || piece.z+piece.height>(exceptions[piece.id] ?? d.height)+0.01
                if outside || weight+piece.kilograms>bay.maxWeight {workspace.enqueuePending(piece);moved+=1}else{weight+=piece.kilograms}
            }
        }
        workspace.dirty=true;setContainerFields(d);showBay(bayIndex,preserveCamera:true)
        status.stringValue="已更新全部货舱，\(moved) 件越界或超载货物转入待装池，其余保留位置。点击重新计算校验留缝、方向与承托。"
    }
    @objc private func undoContainerSize() {
        guard !busy,let saved=vehicleUndo else{return}
        workspace=WorkspaceModel(saved.scene);workspace.dirty=saved.dirty;vehicleUndo=nil
        setContainerFields(workspace.config.containerDimensions);showBay(min(bayIndex,workspace.bays.count-1),preserveCamera:true)
        status.stringValue="已撤销上次货舱调整，货物位置与待装池已恢复。"
    }

    @objc private func editVehicle() {
        guard !busy else{return}
        let alert=NSAlert();alert.messageText="货舱规格与装载规则";alert.informativeText="改变内高或留缝会切换自定义约束，取消原 PDF 高度例外。越界或超载件进入待装池，其余保留预览；主动重新计算。"
        let values=[workspace.config.containerDimensions.length,workspace.config.containerDimensions.width,workspace.config.containerDimensions.height,workspace.config.containerMaxWeight,workspace.config.clearanceMm ?? (workspace.config.loadingProfile=="villa-pdf" ? 5:0)]
        let labels=["内长 mm","内宽 mm","内高 mm","最大载重 kg","三轴留缝 mm"]
        let fields=values.map{NSTextField(string:String($0))};let form=NSStackView();form.orientation = .vertical;form.alignment = .leading;form.spacing=8
        for (i,field) in fields.enumerated() {field.widthAnchor.constraint(equalToConstant:200).isActive=true;form.addArrangedSubview(NSStackView(views:[NSTextField(labelWithString:labels[i]),field]))}
        form.frame=NSRect(x:0,y:0,width:380,height:160);alert.accessoryView=form;alert.addButton(withTitle:"应用修改");alert.addButton(withTitle:"取消")
        if alert.runModal() != .alertFirstButtonReturn{return}
        let parsed=fields.compactMap{Double($0.stringValue)}
        guard parsed.count==5,parsed.allSatisfy({$0.isFinite}),parsed.prefix(4).allSatisfy({$0>0}),parsed[4]>=0,parsed[4]<=1000 else {status.stringValue="货舱尺寸与载重须为有限正数，留缝须在 0–1000 mm。";return}
        applyContainerDimensions(DimsDTO(length:parsed[0],width:parsed[1],height:parsed[2]),maxWeight:parsed[3],gap:parsed[4])
    }
    @objc private func importWorkbook() {
        guard !busy else{return}
        let panel=NSOpenPanel();panel.canChooseFiles=true;panel.allowedContentTypes=["xlsx","xls"].compactMap{UTType(filenameExtension:$0)};panel.canChooseDirectories=false
        guard panel.runModal() == .OK,let url=panel.url else{return}
        busy=true;progress.isHidden=false;progress.isIndeterminate=true;progress.startAnimation(nil);progressText.stringValue="正在读取并检查 Excel 货物清单…";refreshChrome()
        DispatchQueue.global(qos:.userInitiated).async {
            let output=FileManager.default.temporaryDirectory.appendingPathComponent("cargoplan-import-\(UUID().uuidString).json")
            defer {try? FileManager.default.removeItem(at:output)}
            do {
                let size=(try url.resourceValues(forKeys:[.fileSizeKey])).fileSize ?? 0
                if size>20*1024*1024 {throw CheckError("请选择不超过 20 MB 的 Excel 文件")}
                try runNativeIO("import",input:url,output:output)
                let data=try JSONDecoder().decode([[String:JSONValue]].self,from:Data(contentsOf:output));let pieces=try data.map(pieceFromCargo)
                DispatchQueue.main.async {
                    self.workspace.pending=pieces;self.workspace.seed=nil;self.workspace.config.loadingProfile="custom";self.workspace.config.clearanceMm=0;self.workspace.dirty=true
                    self.workspace.bays.forEach{$0.pieces=[]};self.workspace.bays=Array(self.workspace.bays.prefix(1))
                    self.busy=false;self.progress.stopAnimation(nil);self.progress.isHidden=true;self.progressText.stringValue="导入完成 · \(pieces.count) 件待装，请主动重新计算。";self.workspace.summary="已导入 \(pieces.count) 件 · \(url.lastPathComponent)，请重新计算。";self.showBay(0)
                }
            } catch {DispatchQueue.main.async {self.busy=false;self.progress.stopAnimation(nil);self.refreshChrome();NSAlert(error:error).runModal()}}
        }
    }
    @objc private func saveTemplate() { saveWorkbook(template:true) }
    @objc private func exportWorkbook() { saveWorkbook(template:false) }
    private func saveWorkbook(template:Bool) {
        guard !busy else{return}
        if !template && workspace.dirty {status.stringValue="方案有未重算改动，请先重新计算再导出。";return}
        let panel=NSSavePanel();panel.nameFieldStringValue=template ? "装箱货物导入模板.xlsx":"装配方案.xlsx"
        guard panel.runModal() == .OK,let url=panel.url else{return}
        let input=FileManager.default.temporaryDirectory.appendingPathComponent("cargoplan-export-\(UUID().uuidString).json")
        defer {try? FileManager.default.removeItem(at:input)}
        do {if !template {try JSONEncoder().encode(workspace.dto()).write(to:input)};try runNativeIO(template ? "template":"export",input:template ? nil:input,output:url)} catch {NSAlert(error:error).runModal()}
    }

    @objc private func focusPending(_ sender: NSButton) {
        let id = sender.identifier?.rawValue ?? ""
        guard let piece = workspace.pending.first(where: { $0.id == id }) else { return }
        sceneView.select(nil)
        beginEdit(piece.id)
    }

    @objc private func exitOrCancel() {
        guard let _=computeToken else{exitEdit();return}
        computeCancellation?.cancel();computeCancellation=nil;computeToken=nil;RepackProcessSlot.shared.stop();busy=false
        progress.stopAnimation(nil);progress.isHidden=true;progressText.stringValue="已取消计算，输入与待装货物保留。";recalcButton.title="重新计算";refreshChrome();status.stringValue="已取消计算，当前输入、待装池和预览均保留。"
    }
    @objc private func recalculate() {
        if busy { return }
        if editing && !commitEditor() { return }
        exitEdit()
        let token=UUID(),cancellation=EngineCancellation();computeToken=token;computeCancellation=cancellation
        busy = true;progress.isIndeterminate=false;progress.doubleValue=0;progress.isHidden=false;progressText.stringValue="正在启动本地引擎；进度按实际检查和分配件数更新。";recalcButton.title = "计算中…"; refreshChrome()
        var scene=workspace.dto()
        let mode=computeMode.indexOfSelectedItem==1 ? "compare":"quick"
        scene.config.timeLimit=mode=="compare" ? 20000:min(5000,max(1500,Double(workspace.allPieces().count)*2))
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result=try runRepack(scene,cancellation:cancellation,mode:mode){event in
                    DispatchQueue.main.async {
                        guard self.computeToken==token else{return}
                        self.progress.doubleValue=event.percent
                        self.progressText.stringValue="\(event.stage) · \(Int(event.percent))%\n已检查 \(event.processed) / \(event.total) 件 · 本候选 \(event.containers) 柜\n已分配 \(event.placed) · 待装 \(event.unpacked) · \(String(format:"%.1f",Double(event.elapsedMs)/1000)) 秒"
                    }
                }
                DispatchQueue.main.async {
                    guard self.computeToken==token else{return};self.computeToken=nil;self.computeCancellation=nil
                    self.workspace = WorkspaceModel(result)
                    self.workspace.dirty = false
                    self.vehicleUndo=nil;self.setContainerFields(self.workspace.config.containerDimensions)
                    self.busy = false
                    self.progress.stopAnimation(nil)
                    self.progress.doubleValue=100
                    self.progressText.stringValue="完成 · 100%\n\(self.workspace.allPieces().count-self.workspace.pending.count) 件已分配 · \(self.workspace.pending.count) 件待装\n\(self.workspace.bays.count) 柜 · 结果已独立校验"
                    self.recalcButton.title = "重新计算"
                    self.showBay(min(self.bayIndex, max(0, self.workspace.bays.count - 1)))
                    if CommandLine.arguments.contains("--ui-smoke") { self.finishInterfaceSmoke(); return }
                    self.status.stringValue = result.summary ?? "装配方案已更新。"
                }
            } catch {
                DispatchQueue.main.async {
                    guard self.computeToken==token else{return};self.computeToken=nil;self.computeCancellation=nil
                    self.busy = false
                    self.progress.stopAnimation(nil)
                    self.progress.isHidden=true;self.progressText.stringValue="计算未完成，当前输入与待装货物保留。"
                    self.recalcButton.title = "重新计算"
                    self.refreshChrome()
                    if CommandLine.arguments.contains("--ui-smoke") { fputs("UI_SMOKE_FAILED: \(error)\n", stderr); exit(1) }
                    let alert = NSAlert()
                    alert.messageText = "重新计算失败"
                    alert.informativeText = error.localizedDescription
                    alert.runModal()
                }
            }
        }
    }

    func numberOfRows(in tableView: NSTableView) -> Int { workspace.bays[bayIndex].pieces.count }
    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let id = NSUserInterfaceItemIdentifier("piece")
        let cell = tableView.makeView(withIdentifier: id, owner: self) as? NSTableCellView ?? {
            let cell = NSTableCellView(); cell.identifier = id
            let text = NSTextField(labelWithString: ""); text.translatesAutoresizingMaskIntoConstraints = false; text.lineBreakMode = .byTruncatingTail
            cell.addSubview(text); cell.textField = text
            NSLayoutConstraint.activate([
                text.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 4),
                text.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -4),
                text.centerYAnchor.constraint(equalTo: cell.centerYAnchor)
            ])
            return cell
        }()
        cell.textField?.stringValue = workspace.bays[bayIndex].pieces[row].name
        return cell
    }
    func tableViewSelectionDidChange(_ notification: Notification) {
        if suppress { return }
        let row = table.selectedRow
        guard row >= 0 else { sceneView.select(nil); return }
        sceneView.select(workspace.bays[bayIndex].pieces[row].id)
    }

    private func installMenu() {
        let main = NSMenu(); let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "关于 3D CargoPlan 装配", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        let fileItem=NSMenuItem(title:"文件",action:nil,keyEquivalent:"");let fileMenu=NSMenu(title:"文件")
        for (title,action,key) in [("导入 Excel",#selector(importWorkbook),"o"),("下载货物模板",#selector(saveTemplate),""),("导出装配方案",#selector(exportWorkbook),"s")] {
            let item=NSMenuItem(title:title,action:action,keyEquivalent:key);item.target=self;fileMenu.addItem(item)
        }
        fileItem.submenu=fileMenu;main.addItem(fileItem)
        let editItem=NSMenuItem(title:"编辑",action:nil,keyEquivalent:"");let editMenu=NSMenu(title:"编辑")
        for (title,action,key) in [("撤销","undo:","z"),("重做","redo:","Z"),("剪切","cut:","x"),("复制","copy:","c"),("粘贴","paste:","v"),("全选","selectAll:","a")] {
            editMenu.addItem(withTitle:title,action:NSSelectorFromString(action),keyEquivalent:key)
        }
        editItem.submenu=editMenu;main.addItem(editItem)
        let viewItem=NSMenuItem(title:"工作区",action:nil,keyEquivalent:"");let viewMenu=NSMenu(title:"工作区")
        for (index,title) in ["装配","多站点","海运知识库"].enumerated() {
            let item=NSMenuItem(title:title,action:#selector(menuWorkspace(_:)),keyEquivalent:String(index+1));item.tag=index;item.target=self;viewMenu.addItem(item)
        }
        viewItem.submenu=viewMenu;main.addItem(viewItem)
        NSApp.mainMenu = main
    }
    @objc private func menuWorkspace(_ sender:NSMenuItem) {guard !busy else{return};tabs.selectedSegment=sender.tag;changeTab()}

    private func fmt(_ value: Double) -> String { String(format: "%.0f", value) }
}


var isNativeCheck:Bool {Bundle.main.bundleIdentifier?.hasSuffix(".qa170")==true || CommandLine.arguments.contains{$0=="--self-check" || $0.hasSuffix("-smoke")}}
func workspaceSaveURL()->URL {FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("CargoPlan/workspace-v1.json")}
func persistWorkspace(_ scene:SceneDTO,to url:URL=workspaceSaveURL())throws {
    try FileManager.default.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true)
    try JSONEncoder().encode(scene).write(to:url,options:.atomic)
}
func loadScene() throws -> SceneDTO {
    if !isNativeCheck,FileManager.default.fileExists(atPath:workspaceSaveURL().path) {
        do {
            let scene=try JSONDecoder().decode(SceneDTO.self,from:Data(contentsOf:workspaceSaveURL()))
            let items=scene.containers.flatMap(\.items)+scene.pending
            guard !scene.containers.isEmpty,Set(items.map(\.id)).count==items.count else{throw CheckError("保存的工作区数据无效")}
            return scene
        } catch {fputs("WORKSPACE_RESTORE_FAILED: \(error)\n",stderr)}
    }
    guard let url = Bundle.main.url(forResource: "scene", withExtension: "json") else { throw CocoaError(.fileNoSuchFile) }
    return try JSONDecoder().decode(SceneDTO.self, from: Data(contentsOf: url))
}

func repoRoot() throws -> URL {
    let app = Bundle.main.bundleURL
    let output = app.deletingLastPathComponent()
    let repo = output.deletingLastPathComponent()
    if FileManager.default.fileExists(atPath: repo.appendingPathComponent("mac/assembly/repack.mjs").path) { return repo }
    throw NSError(domain: "CargoPlanAssembly", code: 1, userInfo: [NSLocalizedDescriptionKey: "找不到项目根目录中的 mac/assembly/repack.mjs"])
}

final class RepackProcessSlot {
    static let shared = RepackProcessSlot()
    private let lock = NSLock()
    private var active: Process?
    func start(_ process: Process) throws {
        lock.lock(); defer { lock.unlock() }
        try process.run(); active = process
    }
    func hasRunningProcess()->Bool{lock.lock();defer{lock.unlock()};return active?.isRunning ?? false}
    func clear(_ process: Process) {
        lock.lock(); defer { lock.unlock() }
        if active === process { active = nil }
    }
    func stop() {
        lock.lock(); defer { lock.unlock() }
        if let process = active, process.isRunning { process.terminate() }
    }
}

final class EngineCancellation {
    private let lock=NSLock();private var cancelled=false
    func cancel(){lock.lock();cancelled=true;lock.unlock()}
    func start(_ process:Process)throws {
        lock.lock();defer{lock.unlock()}
        if cancelled{throw CheckError("计算已取消")}
        try RepackProcessSlot.shared.start(process)
    }
}
struct NativePackingProgress:Decodable {
    let type,stage,phase:String
    let percent:Double
    let processed,total,containers,placed,unpacked,elapsedMs:Int
}
func runRepack(_ scene:SceneDTO,cancellation:EngineCancellation?=nil,mode:String="quick",onProgress:((NativePackingProgress)->Void)?=nil) throws -> SceneDTO {
    let repo = Bundle.main.resourceURL!
    let temp = FileManager.default.temporaryDirectory.appendingPathComponent("cargoplan-assembly-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: temp) }
    let items = scene.containers.flatMap(\.items).map(\.cargo) + scene.pending.map(\.cargo)
    let inputURL = temp.appendingPathComponent("input.json")
    let outputURL = temp.appendingPathComponent("output.json")
    struct RepackInput: Encodable {
        let items: [[String: JSONValue]]
        let config: ConfigDTO
        let seed: [String: JSONValue]?
        let mode:String
    }
    let enc = JSONEncoder()
    let payload = RepackInput(items: items, config: scene.config, seed: scene.seed,mode:mode)
    try enc.encode(payload).write(to: inputURL)

    let process = Process()
    process.currentDirectoryURL = repo
    process.executableURL = try nativeRuntime()
    process.environment = engineEnvironment()
    process.arguments = [repo.appendingPathComponent("repack.mjs").path, inputURL.path, outputURL.path]
    let logURL = temp.appendingPathComponent("process.log")
    FileManager.default.createFile(atPath: logURL.path, contents: nil)
    let log = try FileHandle(forWritingTo: logURL)
    defer { try? log.close() }
    let stdout=Pipe();process.standardError=log;process.standardOutput=stdout
    if let cancellation {try cancellation.start(process)}else{try RepackProcessSlot.shared.start(process)}
    defer { RepackProcessSlot.shared.clear(process) }
    var buffered=Data()
    while true {
        let chunk=stdout.fileHandleForReading.availableData
        if chunk.isEmpty {break}
        buffered.append(chunk)
        while let end=buffered.firstIndex(of:10) {
            let line=buffered.prefix(upTo:end);buffered.removeSubrange(...end)
            if let event=try? JSONDecoder().decode(NativePackingProgress.self,from:line),event.type=="progress",event.percent.isFinite,event.percent>=0,event.percent<=100 {onProgress?(event)}
        }
    }
    process.waitUntilExit()
    if process.terminationStatus != 0 {
        let message = String(data: (try? Data(contentsOf: logURL)) ?? Data(), encoding: .utf8) ?? "未知错误"
        throw NSError(domain: "CargoPlanAssembly", code: Int(process.terminationStatus), userInfo: [NSLocalizedDescriptionKey: message])
    }
    return try JSONDecoder().decode(SceneDTO.self, from: Data(contentsOf: outputURL))
}

func jsonObject(_ value: [String: JSONValue]) -> [String: Any] {
    var result: [String: Any] = [:]
    for (key, item) in value { result[key] = jsonAny(item) }
    return result
}
func jsonAny(_ value: JSONValue) -> Any {
    switch value {
    case .null: return NSNull()
    case .bool(let value): return value
    case .number(let value): return value
    case .string(let value): return value
    case .object(let value): return jsonObject(value)
    case .array(let value): return value.map(jsonAny)
    }
}

func runSelfCheck() throws {
    let scene = try loadScene()
    let model = WorkspaceModel(scene)
    _ = model.allPieces().map(pieceColor)
    if model.bays.count != 11 { throw CheckError("应为 11 柜") }
    let first = model.bays[0].pieces[0]
    let twin = PieceModel(first.dto())
    twin.x = first.x; twin.y = first.y; twin.z = first.z
    if !piecesOverlap(first, twin) { throw CheckError("重叠检测失败") }
    model.enqueuePending(first)
    if model.bays[0].pieces.contains(where: { $0.id == first.id }) { throw CheckError("进待装池后仍在柜内") }
    if !model.pending.contains(where: { $0.id == first.id }) { throw CheckError("未进入待装池") }
}

struct CheckError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

@main
enum Entry {
    static func main() {
        if CommandLine.arguments.contains("--self-check") {
            do { try runSelfCheck(); fputs("ASSEMBLY_SELF_CHECK_OK\n", stdout); exit(0) }
            catch { fputs("\(error)\n", stderr); exit(1) }
        }
        if CommandLine.arguments.contains("--repack-smoke") {
            do {
                let scene = try loadScene()
                // tiny subset for smoke: first 5 pieces only
                var tiny = scene
                tiny.containers = [BayDTO(id: "t", title: "试算", length: scene.config.containerDimensions.length, width: scene.config.containerDimensions.width, height: scene.config.containerDimensions.height, maxWeight: scene.config.containerMaxWeight, items: Array(scene.containers[0].items.prefix(5)))]
                tiny.pending = Array(scene.containers[0].items.dropFirst(5).prefix(2)).map {
                    var p = $0; p.x = 0; p.y = 0; p.z = 0; return p
                }
                tiny.seed = nil
                tiny.config.timeLimit = 5000
                let out = try runRepack(tiny)
                let originalIDs = Set(tiny.containers.flatMap(\.items).map(\.id) + tiny.pending.map(\.id))
                let resultIDs = out.containers.flatMap(\.items).map(\.id) + out.pending.map(\.id)
                if Set(resultIDs) != originalIDs || resultIDs.count != originalIDs.count { throw CheckError("重算丢件或重复") }
                fputs("REPACK_SMOKE_OK containers=\(out.containers.count) pending=\(out.pending.count)\n", stdout)
                exit(0)
            } catch { fputs("\(error)\n", stderr); exit(1) }
        }
        if CommandLine.arguments.contains("--progress-smoke") {
            do {
                var scene=try loadScene();scene.config.timeLimit=3000
                let start=Date(),ids=Set(scene.containers.flatMap(\.items).map(\.id)+scene.pending.map(\.id))
                var events:[NativePackingProgress]=[]
                let result=try runRepack(scene,onProgress:{events.append($0)})
                let output=result.containers.flatMap(\.items).map(\.id)+result.pending.map(\.id)
                guard Set(output)==ids,output.count==ids.count,!events.isEmpty,events.last?.percent==100,!events.contains(where:{$0.phase=="search"}),zip(events,events.dropFirst()).allSatisfy({$0.percent<=$1.percent}) else{throw CheckError("快速求解、实时进度或守恒检查失败")}
                fputs("NATIVE_PROGRESS_OK pieces=\(ids.count) containers=\(result.containers.count) pending=\(result.pending.count) events=\(events.count) seconds=\(String(format:"%.3f",Date().timeIntervalSince(start))) quick_no_full_search=true final_percent=100\n",stdout);exit(0)
            }catch{fputs("PROGRESS_FAILED: \(error)\n",stderr);exit(1)}
        }
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        withExtendedLifetime(delegate) { app.run() }
    }
}
