// #created 11/08/2026
import AppKit
import RealityKit
import simd

struct NativePort: Decodable {
    let locode,name,country:String
    let name_zh:String?
    let lat,lon:Double
    var title:String { name_zh ?? name }
}
func portVector(_ lat:Double,_ lon:Double,radius:Float=1)->SIMD3<Float> {
    let a=Float(lat * .pi/180),b=Float(lon * .pi/180)
    return SIMD3(cos(a)*cos(b),sin(a),-cos(a)*sin(b))*radius
}
final class NativeEarthView: ARView {
    let earth=Entity(),anchor=AnchorEntity(world:.zero),camera=PerspectiveCamera()
    var ports:[NativePort]=[],points:[SIMD3<Float>]=[]
    var onSelect:((NativePort)->Void)?
    var spinning=true
    private var timer:Timer?
    private var startPoint=CGPoint.zero,moved=false
    private var selection:ModelEntity?
    required init(frame:NSRect) {
        super.init(frame:frame)
        environment.background = .color(NSColor(srgbRed:0.063,green:0.090,blue:0.122,alpha:1))
        scene.addAnchor(anchor);anchor.addChild(earth);anchor.addChild(camera)
        camera.position=[0,0,3.4];camera.camera.fieldOfViewInDegrees=42
        timer=Timer.scheduledTimer(withTimeInterval:1/30,repeats:true) { [weak self] _ in
            guard let self,self.spinning,self.window != nil,!self.isHiddenOrHasHiddenAncestor else { return }
            self.earth.orientation=simd_quatf(angle:0.0015,axis:[0,1,0])*self.earth.orientation
        }
    }
    @available(*,unavailable) required init?(coder:NSCoder) { fatalError() }
    func configure(ports:[NativePort],known:Set<String>) throws {
        self.ports=ports;points=ports.map{portVector($0.lat,$0.lon,radius:1.008)}
        var material=UnlitMaterial(color:NSColor(srgbRed:0.04,green:0.16,blue:0.22,alpha:1))
        if let url=Bundle.main.resourceURL?.appendingPathComponent("knowledge/land.json"),let object=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as? [String:Any],let rings=object["rings"] as? [[[Double]]] {
            let image=NSImage(size:NSSize(width:2048,height:1024));image.lockFocus()
            NSColor(srgbRed:0.035,green:0.115,blue:0.17,alpha:1).setFill();NSRect(x:0,y:0,width:2048,height:1024).fill()
            NSColor(srgbRed:0.14,green:0.34,blue:0.37,alpha:1).setFill()
            for ring in rings {
                let p=NSBezierPath()
                for (i,xy) in ring.enumerated() { let v=NSPoint(x:(xy[0]+180)/360*2048,y:(xy[1]+90)/180*1024);if i==0 {p.move(to:v)} else {p.line(to:v)} };p.close();p.fill()
            }
            NSColor(white:0.7,alpha:0.09).setStroke()
            for lon in stride(from:0,through:2048,by:85) { let p=NSBezierPath();p.move(to:NSPoint(x:lon,y:0));p.line(to:NSPoint(x:lon,y:1024));p.stroke() }
            image.unlockFocus()
            if let cg=image.cgImage(forProposedRect:nil,context:nil,hints:nil) { material.color.tint = .white; material.color.texture = .init(try TextureResource.generate(from:cg,options:.init(semantic:.color))) }
        }
        // Explicit UV coordinates keep the local Natural Earth texture aligned to port coordinates.
        var positions:[SIMD3<Float>]=[],uvs:[SIMD2<Float>]=[],triangles:[UInt32]=[]
        let rows=64,columns=128
        for row in 0...rows { for col in 0...columns { positions.append(portVector(-90+Double(row)/Double(rows)*180,-180+Double(col)/Double(columns)*360));uvs.append([Float(col)/Float(columns),Float(row)/Float(rows)]) } }
        for row in 0..<rows { for col in 0..<columns { let a=UInt32(row*(columns+1)+col),b=a+UInt32(columns+1);triangles += [a,a+1,b,a+1,b+1,b] } }
        var descriptor=MeshDescriptor(name:"Earth");descriptor.positions=MeshBuffer(positions);descriptor.textureCoordinates=MeshBuffer(uvs);descriptor.primitives = .triangles(triangles)
        earth.addChild(ModelEntity(mesh:try MeshResource.generate(from:[descriptor]),materials:[material]))
        var dots:[SIMD3<Float>]=[],indices:[UInt32]=[]
        for point in points {
            let normal=simd_normalize(point),ref:SIMD3<Float>=abs(normal.y)>0.9 ? [1,0,0]:[0,1,0]
            let right=simd_normalize(simd_cross(normal,ref))*0.0025,up=simd_normalize(simd_cross(normal,right))*0.0025
            let i=UInt32(dots.count);dots += [point-right-up,point+right-up,point+right+up,point-right+up];indices += [i,i+1,i+2,i,i+2,i+3]
        }
        var dotMesh=MeshDescriptor(name:"Ports");dotMesh.positions=MeshBuffer(dots);dotMesh.primitives = .triangles(indices)
        earth.addChild(ModelEntity(mesh:try MeshResource.generate(from:[dotMesh]),materials:[UnlitMaterial(color:NSColor(srgbRed:0.30,green:0.66,blue:0.70,alpha:1))]))
        for port in ports where known.contains(port.locode) {
            let dot=ModelEntity(mesh:.generateSphere(radius:0.008),materials:[UnlitMaterial(color:NSColor(srgbRed:0.68,green:0.91,blue:0.64,alpha:1))]);dot.position=portVector(port.lat,port.lon,radius:1.015);earth.addChild(dot)
        }
        focus(ports.first(where:{$0.locode=="CNSHA"}) ?? ports[0])
        spinning=false
    }
    func focus(_ port:NativePort) {
        spinning=false
        let point=portVector(port.lat,port.lon)
        earth.orientation=simd_quatf(angle:Float(port.lat * .pi/180),axis:[1,0,0])*simd_quatf(angle:Float(-port.lon * .pi/180 - .pi/2),axis:[0,1,0])
        selection?.removeFromParent()
        let dot=ModelEntity(mesh:.generateSphere(radius:0.012),materials:[UnlitMaterial(color:NSColor(srgbRed:1,green:0.78,blue:0.35,alpha:1))]);dot.position=point*1.023;earth.addChild(dot);selection=dot
    }
    override func mouseDown(with event:NSEvent) { startPoint=convert(event.locationInWindow,from:nil);moved=false;spinning=false }
    override func mouseDragged(with event:NSEvent) {
        moved=true
        earth.orientation=simd_quatf(angle:Float(event.deltaX)*0.006,axis:[0,1,0])*simd_quatf(angle:Float(event.deltaY)*0.006,axis:[1,0,0])*earth.orientation
    }
    override func mouseUp(with event:NSEvent) {
        guard !moved else {return}
        let click=convert(event.locationInWindow,from:nil)
        var best:NativePort?,distance:CGFloat=18
        for (i,point) in points.enumerated() {
            let world=earth.convert(position:point,to:nil)
            guard simd_dot(world,camera.position-world)>0,let screen=project(world) else {continue}
            let d=hypot(screen.x-click.x,screen.y-click.y)
            if d<distance {best=ports[i];distance=d}
        }
        if let best {focus(best);onSelect?(best)}
    }
    override func scrollWheel(with event:NSEvent) { camera.position.z=max(2.1,min(6,camera.position.z+Float(event.scrollingDeltaY)*0.015)) }
}

final class NativeGlobePanel:NSView,NSTableViewDataSource,NSTableViewDelegate,NSSearchFieldDelegate {
    let globe=NativeEarthView(frame:.zero)
    let dossier=WorkspaceWeb()
    private let search=NSSearchField(),table=NSTableView(),spin=NSButton(title:"开启自转",target:nil,action:nil)
    private var ports:[NativePort]=[],filtered:[NativePort]=[],known=Set<String>()
    private(set) var selectedCode="CNSHA"
    var onSelection:((String)->Void)?
    var onMessage:(([String:Any])->Void)?
    init(frame:NSRect,service:WorkspaceWeb) {
        super.init(frame:frame)
        do {
            let base=Bundle.main.resourceURL!.appendingPathComponent("knowledge")
            ports=try JSONDecoder().decode([NativePort].self,from:Data(contentsOf:base.appendingPathComponent("ports.json")))
            known=Set(try FileManager.default.contentsOfDirectory(at:base.appendingPathComponent("port_packs"),includingPropertiesForKeys:nil).filter{$0.pathExtension=="json"}.map{$0.deletingPathExtension().lastPathComponent})
            ports.sort{a,b in known.contains(a.locode) != known.contains(b.locode) ? known.contains(a.locode) : a.locode < b.locode}
            filtered=Array(ports.prefix(200));try globe.configure(ports:ports,known:known)
        } catch {fputs("KNOWLEDGE_DATA_ERROR: \(error)\n",stderr)}
        dossier.nativeMode="port-dossier";dossier.useService(from:service)
        dossier.onMessage={ [weak self] message in self?.onMessage?(message) }
        let column=NSTableColumn(identifier:.init("port"));table.addTableColumn(column);table.headerView=nil;table.dataSource=self;table.delegate=self;table.rowHeight=42;table.backgroundColor = .clear
        let list=NSScrollView();list.documentView=table;list.hasVerticalScroller=true
        search.placeholderString="搜索港名 / CNSHA / 国家代码";search.delegate=self
        let caption=NSTextField(wrappingLabelWithString:"\(ports.count.formatted()) 港点 · \(known.count) 个已建包\n浅蓝为基础坐标，浅绿为已有知识，金色为选中港口。")
        caption.textColor = .secondaryLabelColor;caption.font = .systemFont(ofSize:12)
        let left=NSStackView(views:[search,caption,list]);left.orientation = .vertical;left.alignment = .leading;left.spacing=12
        spin.target=self;spin.action=#selector(toggleSpin)
        let hint=NSTextField(labelWithString:"REALITYKIT  /  拖动旋转 · 滚轮缩放 · 点击港点")
        hint.font = .systemFont(ofSize:11,weight:.medium);hint.textColor = .secondaryLabelColor
        let bar=NSStackView(views:[hint,spin]);bar.orientation = .horizontal;bar.spacing=14
        let center=NSStackView(views:[bar,globe]);center.orientation = .vertical;center.alignment = .leading;center.spacing=10
        let right=dossier.view
        right.wantsLayer=true;right.layer?.cornerRadius=12;right.layer?.masksToBounds=true
        let split=NSSplitView();split.isVertical=true;split.dividerStyle = .thin;split.addArrangedSubview(center);split.addArrangedSubview(right)
        split.setHoldingPriority(.defaultLow,forSubviewAt:0);split.setHoldingPriority(.defaultHigh,forSubviewAt:1)
        let preferredWidth=right.widthAnchor.constraint(equalToConstant:440);preferredWidth.priority = .defaultLow
        let row=NSStackView(views:[left,split]);row.orientation = .horizontal;row.spacing=16;row.translatesAutoresizingMaskIntoConstraints=false;addSubview(row)
        NSLayoutConstraint.activate([row.leadingAnchor.constraint(equalTo:leadingAnchor,constant:16),row.trailingAnchor.constraint(equalTo:trailingAnchor,constant:-16),row.topAnchor.constraint(equalTo:topAnchor,constant:16),row.bottomAnchor.constraint(equalTo:bottomAnchor,constant:-16),left.widthAnchor.constraint(equalToConstant:225),right.widthAnchor.constraint(greaterThanOrEqualToConstant:380),right.widthAnchor.constraint(lessThanOrEqualToConstant:700),preferredWidth,left.heightAnchor.constraint(equalTo:row.heightAnchor),split.heightAnchor.constraint(equalTo:row.heightAnchor),split.widthAnchor.constraint(equalTo:row.widthAnchor,constant:-241),center.heightAnchor.constraint(equalTo:split.heightAnchor),right.heightAnchor.constraint(equalTo:split.heightAnchor),center.widthAnchor.constraint(greaterThanOrEqualToConstant:380),globe.widthAnchor.constraint(equalTo:center.widthAnchor),bar.heightAnchor.constraint(equalToConstant:28),globe.heightAnchor.constraint(equalTo:center.heightAnchor,constant:-38),search.widthAnchor.constraint(equalTo:left.widthAnchor),caption.widthAnchor.constraint(equalTo:left.widthAnchor),list.widthAnchor.constraint(equalTo:left.widthAnchor),globe.heightAnchor.constraint(greaterThanOrEqualToConstant:400),list.heightAnchor.constraint(greaterThanOrEqualToConstant:240)])
        globe.onSelect={ [weak self] port in self?.selectPort(port.locode,focus:false) }
        showDetails()
    }
    required init?(coder:NSCoder) {fatalError()}
    @objc private func toggleSpin(){globe.spinning.toggle();spin.title=globe.spinning ? "暂停自转":"开启自转"}
    func selectPort(_ code:String,focus:Bool=true) {
        guard let port=ports.first(where:{$0.locode==code}) else{return}
        selectedCode=code;if focus {globe.focus(port)};spin.title="开启自转";showDetails()
    }
    func controlTextDidChange(_ notification:Notification) {
        let q=search.stringValue.lowercased()
        filtered=Array(ports.filter{q.isEmpty || "\($0.title) \($0.name) \($0.locode) \($0.country)".lowercased().contains(q)}.prefix(200));table.reloadData()
    }
    func numberOfRows(in tableView:NSTableView)->Int {filtered.count}
    func tableView(_ tableView:NSTableView,viewFor tableColumn:NSTableColumn?,row:Int)->NSView? {
        let p=filtered[row];let label=NSTextField(labelWithString:"\(p.title)\n\(p.locode)  ·  \(known.contains(p.locode) ? "已有知识包":"基础坐标")");label.font = .systemFont(ofSize:12);label.lineBreakMode = .byTruncatingTail;return label
    }
    func tableViewSelectionDidChange(_ notification:Notification) {guard filtered.indices.contains(table.selectedRow) else{return};selectPort(filtered[table.selectedRow].locode)}
    private func showDetails(){dossier.setSupportContext(workspace:"ports",portCode:selectedCode);dossier.show("ports");onSelection?(selectedCode)}
    func stop(){dossier.stop()}
}

