// #created 11/08/2026
import { app, BrowserWindow, Menu, dialog, shell, protocol, net, utilityProcess } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFile, mkdir } from 'node:fs/promises'

const here = path.dirname(fileURLToPath(import.meta.url))
const smoke = process.argv.includes('--desktop-smoke')
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), `cargoplan-smoke-${process.pid}`))
protocol.registerSchemesAsPrivileged([{ scheme: 'cargoplan', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }])
let window, service, origin, quitting = false
const home = 'cargoplan://app/'
const requestedWorkspace = args => args.find(arg => /^--workspace=(bench|demo|ports|value)$/.test(arg))?.split('=')[1] ?? 'demo'
const external = url => /^https?:\/\//i.test(url)

function startService() {
  return new Promise((resolve, reject) => {
    service = utilityProcess.fork(path.join(here, 'server.mjs'), [app.getAppPath()], { serviceName: '3D CargoPlan 计算服务' })
    const timer = setTimeout(() => reject(new Error('本地计算服务启动超时')), 20000)
    service.on('message', message => {
      if (message.type === 'ready') { clearTimeout(timer); origin = `http://127.0.0.1:${message.port}`; resolve() }
    })
    service.on('exit', code => {
      clearTimeout(timer)
      if (!origin) reject(new Error(`本地计算服务启动失败 (${code})`))
      else if (!quitting) { dialog.showErrorBox('计算服务已停止', '请重新启动 3D CargoPlan。'); app.quit() }
    })
  })
}
async function exportPdf() {
  const { canceled, filePath } = await dialog.showSaveDialog(window, { defaultPath: '3D CargoPlan-当前视图.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (!canceled && filePath) {
    try { await writeFile(filePath, await window.webContents.printToPDF({ printBackground: true, landscape: true })) }
    catch (error) { dialog.showErrorBox('导出失败', error.message) }
  }
}
function makeWindow() {
  window = new BrowserWindow({ width: 1500, height: 960, minWidth: 1024, minHeight: 700, title: '3D CargoPlan · 海陆运输作业智能体', backgroundColor: '#09151f', show: false,
    webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } })
  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(({ url }) => { if (external(url)) void shell.openExternal(url); return { action: 'deny' } })
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== new URL(home).origin || !url.startsWith(home)) { event.preventDefault(); if (external(url)) void shell.openExternal(url) }
  })
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  const navigate = workspace => window.webContents.send('workspace:navigate', workspace)
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '3D CargoPlan', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { label: '文件', submenu: [{ label: '导出当前视图 PDF…', accelerator: 'CmdOrCtrl+Shift+P', click: exportPdf }, { type: 'separator' }, { role: 'close' }] },
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '工作区', submenu: [['装箱工作台','bench'],['海陆装配与多站点','demo'],['客户价值','value'],['全球港口知识库','ports']].map(([label,id], i) => ({ label, accelerator: `CmdOrCtrl+${i+1}`, click: () => navigate(id) })) },
    { label: '显示', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }] }
  ]))
  window.on('closed', () => { window = null })
  return window.loadURL(`${home}#${requestedWorkspace(process.argv)}`)
}
async function runSmoke() {
  const { runDesktopSmoke } = await import('./smoke.mjs')
  await runDesktopSmoke(window, service.pid)
}

if (!smoke && !app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', (_event, argv) => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); window.webContents.send('workspace:navigate', requestedWorkspace(argv)) } })
  app.whenReady().then(async () => {
    await startService()
    protocol.handle('cargoplan', async request => {
      const url = new URL(request.url)
      if (url.hostname !== 'app') return new Response('Not found', { status: 404 })
      const headers = new Headers(request.headers)
      headers.delete('host'); headers.delete('origin')
      const body = ['GET','HEAD'].includes(request.method) ? undefined : await request.arrayBuffer()
      const response = await net.fetch(`${origin}${url.pathname}${url.search}`, { method: request.method, headers, body })
      const outgoing = new Headers(response.headers)
      outgoing.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' data:; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outgoing })
    })
    await makeWindow()
    app.on('activate', () => { if (!window) void makeWindow(); else window.show() })
    if (smoke) { await runSmoke(); app.quit() }
  }).catch(async error => {
    console.error(error)
    if (smoke) {
      await mkdir(path.resolve('output/desktop'), { recursive: true })
      await writeFile(path.resolve('output/desktop/smoke-error.txt'), error.stack || String(error))
      app.exit(1)
    } else { dialog.showErrorBox('3D CargoPlan 启动失败', error.message); app.quit() }
  })
}
app.on('before-quit', () => { quitting = true; service?.postMessage('shutdown') })
app.on('will-quit', () => { service?.kill() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
