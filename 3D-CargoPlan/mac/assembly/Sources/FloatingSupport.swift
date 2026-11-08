// #created 11/08/2026
import AppKit

/// An in-window overlay: it never replaces a workspace or creates another window.
final class FloatingSupport:NSObject {
    let web=WorkspaceWeb()
    let button=NSButton(title:"✦  3D CargoPlan 助手",target:nil,action:nil)
    let panel=NSView()
    private(set) var opened=false
    private var available=true
    init(host:NSView,service:WorkspaceWeb) {
        super.init()
        web.nativeMode="assistant-widget";web.useService(from:service)
        web.onMessage={ [weak self] message in if message["type"] as? String == "assistant-close" {self?.hide()} }
        button.target=self;button.action=#selector(toggle);button.bezelStyle = .rounded
        button.font = .systemFont(ofSize:13,weight:.semibold);button.bezelColor=NSColor(srgbRed:0.76,green:0.90,blue:0.66,alpha:1);button.contentTintColor=NSColor(srgbRed:0.09,green:0.18,blue:0.13,alpha:1)
        button.toolTip="留在当前工作区，咨询操作、地区政策和航运问题"
        panel.wantsLayer=true;panel.layer?.backgroundColor=NSColor(srgbRed:0.07,green:0.13,blue:0.18,alpha:1).cgColor
        panel.layer?.cornerRadius=16;panel.layer?.borderWidth=1;panel.layer?.borderColor=NSColor.white.withAlphaComponent(0.16).cgColor
        panel.shadow=NSShadow();panel.shadow?.shadowBlurRadius=30;panel.shadow?.shadowOffset=NSSize(width:0,height:-9);panel.shadow?.shadowColor=NSColor.black.withAlphaComponent(0.4)
        web.view.wantsLayer=true;web.view.layer?.cornerRadius=16;web.view.layer?.masksToBounds=true
        panel.translatesAutoresizingMaskIntoConstraints=false;button.translatesAutoresizingMaskIntoConstraints=false;web.view.translatesAutoresizingMaskIntoConstraints=false
        panel.addSubview(web.view);host.addSubview(panel);host.addSubview(button)
        let height=panel.heightAnchor.constraint(equalToConstant:610);height.priority = .defaultHigh
        NSLayoutConstraint.activate([button.trailingAnchor.constraint(equalTo:host.trailingAnchor,constant:-22),button.bottomAnchor.constraint(equalTo:host.bottomAnchor,constant:-18),button.widthAnchor.constraint(equalToConstant:160),button.heightAnchor.constraint(equalToConstant:38),panel.trailingAnchor.constraint(equalTo:host.trailingAnchor,constant:-22),panel.bottomAnchor.constraint(equalTo:button.topAnchor,constant:-12),panel.widthAnchor.constraint(equalToConstant:390),height,panel.heightAnchor.constraint(lessThanOrEqualTo:host.heightAnchor,constant:-150),web.view.leadingAnchor.constraint(equalTo:panel.leadingAnchor,constant:1),web.view.trailingAnchor.constraint(equalTo:panel.trailingAnchor,constant:-1),web.view.topAnchor.constraint(equalTo:panel.topAnchor,constant:1),web.view.bottomAnchor.constraint(equalTo:panel.bottomAnchor,constant:-1)])
        panel.isHidden=true
    }
    @objc private func toggle(){if opened{hide()}else{show()}}
    func show(){opened=true;web.show("ports");refresh()}
    func hide(){opened=false;refresh()}
    func setAvailable(_ value:Bool){available=value;refresh()}
    func setContext(workspace:String,portCode:String?){web.setSupportContext(workspace:workspace,portCode:portCode)}
    private func refresh(){button.isHidden = !available;panel.isHidden = !available || !opened;button.title=opened ? "×  收起助手":"✦  3D CargoPlan 助手"}
    func stop(){web.stop()}
}
