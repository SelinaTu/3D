// #created 11/08/2026
import AppKit
import Network
import WebKit

private let pageBackground = NSColor(srgbRed: 6.0 / 255.0, green: 19.0 / 255.0, blue: 31.0 / 255.0, alpha: 1)

@main
enum Entry {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        withExtendedLifetime(delegate) {
            app.run()
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow?
    private var server: LocalWebServer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenu()
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true),
              FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path) else {
            presentFailure("应用里没有地球仪页面。")
            return
        }
        let server: LocalWebServer
        do {
            server = try LocalWebServer(root: root)
            try server.start()
        } catch {
            presentFailure("本地页面服务没有启动。\(error.localizedDescription)")
            return
        }
        self.server = server
        guard let url = URL(string: "http://127.0.0.1:\(server.port)/") else {
            presentFailure("本地地址无效。")
            return
        }
        openWindow(url)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    private func openWindow(_ url: URL) {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 800), configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        if #available(macOS 12.0, *) {
            webView.underPageBackgroundColor = pageBackground
        }
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 800),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "3D CargoPlan · 3D全球港口知识地球仪"
        window.backgroundColor = pageBackground
        window.minSize = NSSize(width: 960, height: 640)
        window.contentView = webView
        window.center()
        window.makeKeyAndOrderFront(nil)
        self.window = window
        webView.load(URLRequest(url: url))
    }

    private func presentFailure(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "港口知识地球仪打不开"
        alert.informativeText = message
        alert.runModal()
        NSApp.terminate(nil)
    }

    private func installMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "关于港口知识地球仪", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "隐藏", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: "隐藏其他", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "显示全部", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出港口知识地球仪", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let editItem = NSMenuItem()
        main.addItem(editItem)
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "拷贝", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu

        let windowItem = NSMenuItem()
        main.addItem(windowItem)
        let windowMenu = NSMenu(title: "窗口")
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "缩放", action: #selector(NSWindow.zoom(_:)), keyEquivalent: "")
        windowItem.submenu = windowMenu
        NSApp.windowsMenu = windowMenu
        NSApp.mainMenu = main
    }
}

final class LocalWebServer {
    let root: URL
    private(set) var port: UInt16 = 0
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "cargoplan.knowledge-globe.http")

    init(root: URL) throws {
        let standardized = root.standardizedFileURL
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: standardized.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            throw ServerError.missingRoot
        }
        self.root = standardized
    }

    func start() throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = NWEndpoint.hostPort(host: .ipv4(IPv4Address.loopback), port: .any)
        parameters.allowLocalEndpointReuse = true
        let listener = try NWListener(using: parameters)
        let ready = DispatchSemaphore(value: 0)
        var startError: Error?
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready:
                ready.signal()
            case .failed(let error):
                startError = error
                ready.signal()
            default:
                break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            self?.accept(connection)
        }
        listener.start(queue: queue)
        ready.wait()
        if let startError {
            throw startError
        }
        guard let assigned = listener.port else {
            throw ServerError.noPort
        }
        port = assigned.rawValue
        self.listener = listener
    }

    private func accept(_ connection: NWConnection) {
        connection.start(queue: queue)
        receiveHeader(on: connection, buffer: Data())
    }

    private func receiveHeader(on connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            if error != nil || (isComplete && data == nil && buffer.isEmpty) {
                connection.cancel()
                return
            }
            var next = buffer
            if let data {
                next.append(data)
            }
            if next.count > 16 * 1024 {
                self.respond(connection, status: 400, type: "text/plain; charset=utf-8", body: Data("请求过长".utf8))
                return
            }
            if let range = next.range(of: Data("\r\n\r\n".utf8)) {
                let head = next.subdata(in: next.startIndex..<range.lowerBound)
                self.serve(connection, header: head)
                return
            }
            if isComplete {
                connection.cancel()
                return
            }
            self.receiveHeader(on: connection, buffer: next)
        }
    }

    private func serve(_ connection: NWConnection, header: Data) {
        guard let text = String(data: header, encoding: .utf8) else {
            respond(connection, status: 400, type: "text/plain; charset=utf-8", body: Data("无法读取请求".utf8))
            return
        }
        let requestLine = text.split(separator: "\r\n", maxSplits: 1, omittingEmptySubsequences: false).first ?? ""
        let parts = requestLine.split(separator: " ")
        guard parts.count >= 2, parts[0] == "GET" else {
            respond(connection, status: 405, type: "text/plain; charset=utf-8", body: Data("只接受 GET".utf8))
            return
        }
        let rawTarget = String(parts[1])
        let pathOnly = rawTarget.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? "/"
        guard let relative = safeRelativePath(pathOnly) else {
            respond(connection, status: 403, type: "text/plain; charset=utf-8", body: Data("路径不允许".utf8))
            return
        }
        let candidate = relative.isEmpty ? root.appendingPathComponent("index.html") : root.appendingPathComponent(relative)
        var isDirectory: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDirectory)
        let file = (exists && isDirectory.boolValue) ? candidate.appendingPathComponent("index.html") : candidate
        let resolved = file.resolvingSymlinksInPath().standardizedFileURL
        guard resolved.path.hasPrefix(root.path + "/") || resolved.path == root.appendingPathComponent("index.html").path else {
            respond(connection, status: 403, type: "text/plain; charset=utf-8", body: Data("路径不允许".utf8))
            return
        }
        guard let body = try? Data(contentsOf: resolved) else {
            respond(connection, status: 404, type: "text/plain; charset=utf-8", body: Data("没有这个文件".utf8))
            return
        }
        respond(connection, status: 200, type: mimeType(for: resolved), body: body)
    }

    private func safeRelativePath(_ target: String) -> String? {
        let decoded = target.removingPercentEncoding ?? target
        guard decoded.hasPrefix("/"), !decoded.contains("\0") else { return nil }
        let trimmed = String(decoded.dropFirst())
        if trimmed.isEmpty { return "" }
        let pieces = trimmed.split(separator: "/").map(String.init)
        if pieces.contains("..") || pieces.contains(".") { return nil }
        return pieces.joined(separator: "/")
    }

    private func mimeType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "txt", "md": return "text/plain; charset=utf-8"
        default: return "application/octet-stream"
        }
    }

    private func respond(_ connection: NWConnection, status: Int, type: String, body: Data) {
        let reason: String
        switch status {
        case 200: reason = "OK"
        case 400: reason = "Bad Request"
        case 403: reason = "Forbidden"
        case 404: reason = "Not Found"
        case 405: reason = "Method Not Allowed"
        default: reason = "Error"
        }
        var header = "HTTP/1.1 \(status) \(reason)\r\n"
        header += "Content-Type: \(type)\r\n"
        header += "Content-Length: \(body.count)\r\n"
        header += "Connection: close\r\n"
        header += "Cache-Control: no-store\r\n\r\n"
        var payload = Data(header.utf8)
        payload.append(body)
        connection.send(content: payload, completion: .contentProcessed { _ in
            connection.cancel()
        })
    }
}

enum ServerError: LocalizedError {
    case missingRoot
    case noPort

    var errorDescription: String? {
        switch self {
        case .missingRoot: return "页面目录不存在。"
        case .noPort: return "没有分到本地端口。"
        }
    }
}
