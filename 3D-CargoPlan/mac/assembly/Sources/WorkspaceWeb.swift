// #created 11/08/2026
import AppKit
import WebKit
import UniformTypeIdentifiers

func nativeRuntime() throws -> URL {
    guard let root = Bundle.main.resourceURL else { throw CheckError("应用资源缺失") }
    let runtime = root.appendingPathComponent("Runtime.app/Contents/MacOS/Electron")
    guard FileManager.default.isExecutableFile(atPath: runtime.path) else { throw CheckError("应用内计算运行时缺失，请重新构建。") }
    return runtime
}
func engineEnvironment() -> [String:String] {
    var env = ProcessInfo.processInfo.environment
    env["ELECTRON_RUN_AS_NODE"] = "1"; env["HOST"] = "127.0.0.1"; env["PORT"] = "0"
    return env
}

final class WorkspaceWeb: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    let view: WKWebView
    private var process: Process?
    private var base: String?
    private var desired = "demo"
    private let pipe = Pipe()
    private var received = ""
    private var loaded = false
    private var contextJSON = "null"
    private var supportContextJSON = "{}"
    private var requested = false
    private var stopped = false
    private var serviceProvider: WorkspaceWeb?
    private var serviceWaiters: [(String?) -> Void] = []
    var nativeMode = "1"
    var onMessage: (([String:Any]) -> Void)?
    var onReady: (() -> Void)?
    override init() {
        let controller = WKUserContentController()
        controller.addUserScript(WKUserScript(source:"document.documentElement.style.colorScheme='dark';document.addEventListener('DOMContentLoaded',()=>document.body.classList.add('native-app'));",injectionTime:.atDocumentStart,forMainFrameOnly:true))
        let config = WKWebViewConfiguration(); config.userContentController = controller
        view = WKWebView(frame:.zero,configuration:config)
        super.init()
        controller.add(self,name:"cargoPlan")
        view.navigationDelegate = self; view.uiDelegate = self
        view.underPageBackgroundColor = NSColor(srgbRed:0.063,green:0.090,blue:0.122,alpha:1)
    }
    func setContext(_ scene: SceneDTO, bayIndex: Int, dirty: Bool) {
        struct Context: Encodable { let seed: [String:JSONValue]?;let bayIndex:Int;let dirty:Bool }
        let encoder=JSONEncoder();encoder.outputFormatting = .sortedKeys
        guard let data=try? encoder.encode(Context(seed:scene.seed,bayIndex:bayIndex,dirty:dirty)),let json=String(data:data,encoding:.utf8),json != contextJSON else {return}
        contextJSON=json
        if loaded { publishContext() }
    }
    private func publishContext() {
        view.evaluateJavaScript("window.cargoPlanNativeContext=\(contextJSON);window.dispatchEvent(new Event('cargoplan-native-context'));true",completionHandler: { _,error in if let error { fputs("CONTEXT_JS_ERROR: \(error)\n",stderr) } })
        view.evaluateJavaScript("window.cargoPlanSupportContext=\(supportContextJSON);window.dispatchEvent(new Event('cargoplan-support-context'));true",completionHandler:nil)
    }
    func useService(from provider: WorkspaceWeb) { serviceProvider=provider }
    func setSupportContext(workspace: String, portCode: String? = nil) {
        var value=["workspace":workspace];if let portCode {value["portCode"]=portCode}
        guard let data=try? JSONEncoder().encode(value),let json=String(data:data,encoding:.utf8),json != supportContextJSON else{return}
        supportContextJSON=json;if loaded {publishContext()}
    }
    private func serviceURL(_ completion: @escaping(String?) -> Void) {
        if stopped {completion(nil);return}
        if let base {completion(base);return}
        serviceWaiters.append(completion)
        if process == nil {start()}
    }
    func setCargoEditor(_ item: [String:JSONValue], count:Int) {
        struct EditorContext:Encodable {let item:[String:JSONValue];let count:Int}
        guard let data=try? JSONEncoder().encode(EditorContext(item:item,count:count)),let json=String(data:data,encoding:.utf8) else{return}
        view.configuration.userContentController.addUserScript(WKUserScript(source:"window.cargoPlanCargoEditor=\(json);",injectionTime:.atDocumentStart,forMainFrameOnly:true))
    }
    func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.host == "127.0.0.1",let body=message.body as? [String:Any] else {return}
        onMessage?(body)
    }
    func show(_ workspace: String) {
        guard !stopped else{return}
        requested=true
        desired = workspace
        if let base {
            if loaded {
                if nativeMode != "1" {return}
                let label = ["ports":"海运知识库","value":"客户价值" ][workspace] ?? "海陆样例"
                view.evaluateJavaScript("Array.from(document.querySelectorAll('.app-header button')).find(b=>b.textContent.includes('\(label)'))?.click()",completionHandler:nil)
            } else { view.load(URLRequest(url:URL(string:base+"/?native="+nativeMode+"#"+desired)!)) }
        } else if let serviceProvider {
            serviceProvider.serviceURL { [weak self] url in
                guard let self,!self.stopped else{return}
                if let url {self.base=url;self.show(self.desired)}
                else {self.view.loadHTMLString("<p>本地工作区暂时不可用，请重新打开应用。</p>",baseURL:nil)}
            }
        } else if process == nil { start() }
    }
    private func start() {
        do {
            let p = Process(); p.executableURL = try nativeRuntime(); p.environment = engineEnvironment()
            let root = Bundle.main.resourceURL!.appendingPathComponent("runtime")
            p.currentDirectoryURL = root; p.arguments = [root.appendingPathComponent("dist-server/index.mjs").path]
            p.standardOutput = pipe
            let logURL = FileManager.default.temporaryDirectory.appendingPathComponent("cargoplan-local-service.log")
            FileManager.default.createFile(atPath:logURL.path,contents:nil)
            p.standardError = try FileHandle(forWritingTo:logURL)
            pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
                let data = handle.availableData
                guard !data.isEmpty else { return }
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.received += String(decoding:data,as:UTF8.self)
                    if self.base == nil, let range = self.received.range(of:"http://127.0.0.1:"), let port = self.received[range.upperBound...].split(whereSeparator:{ !$0.isNumber }).first {
                        self.base = "http://127.0.0.1:\(port)"
                        if self.requested {self.show(self.desired)}
                        let callbacks=self.serviceWaiters;self.serviceWaiters.removeAll();callbacks.forEach{$0(self.base)}
                    }
                }
            }
            try p.run(); process = p
        } catch { let callbacks=serviceWaiters;serviceWaiters.removeAll();callbacks.forEach{$0(nil)};view.loadHTMLString("<body style='background:#09151f;color:#d9e7e9;font:18px system-ui;padding:40px'>本地工作区启动失败，请重新打开应用。<p>\(error.localizedDescription)</p></body>",baseURL:nil) }
    }
    func webView(_ webView:WKWebView,navigationAction:WKNavigationAction,didBecome download:WKDownload) { download.delegate=self }
    func webView(_ webView:WKWebView,navigationResponse:WKNavigationResponse,didBecome download:WKDownload) { download.delegate=self }
    func download(_ download:WKDownload,decideDestinationUsing response:URLResponse,suggestedFilename:String,completionHandler:@escaping(URL?)->Void) {
        let panel=NSSavePanel();panel.nameFieldStringValue=suggestedFilename
        panel.allowedContentTypes=[UTType(filenameExtension:URL(fileURLWithPath:suggestedFilename).pathExtension) ?? .data]
        panel.begin { response in completionHandler(response == .OK ? panel.url:nil) }
    }
    func stop() { stopped=true;let callbacks=serviceWaiters;serviceWaiters.removeAll();callbacks.forEach{$0(nil)};view.configuration.userContentController.removeScriptMessageHandler(forName:"cargoPlan"); pipe.fileHandleForReading.readabilityHandler = nil; if let process,process.isRunning { process.terminate() } }
    func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!) { loaded = true; publishContext(); show(desired); onReady?() }
    func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel);return }
        if url.host == "127.0.0.1" || url.scheme == "about" || url.scheme == "blob" { decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow) }
        else { if ["https","http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) };decisionHandler(.cancel) }
    }
    func webView(_ webView:WKWebView,createWebViewWith configuration:WKWebViewConfiguration,for navigationAction:WKNavigationAction,windowFeatures:WKWindowFeatures)->WKWebView? {
        if let url = navigationAction.request.url,["https","http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) };return nil
    }
    func webView(_ webView:WKWebView,runOpenPanelWith parameters:WKOpenPanelParameters,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping([URL]?)->Void) {
        let panel=NSOpenPanel();panel.allowsMultipleSelection=parameters.allowsMultipleSelection
        panel.canChooseFiles=true;panel.canChooseDirectories=false;panel.allowedContentTypes=[.item];panel.allowsOtherFileTypes=true
        panel.begin { response in completionHandler(response == .OK ? panel.urls : nil) }
    }
}
