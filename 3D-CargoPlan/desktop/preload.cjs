// #created 11/08/2026
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('cargoPlanDesktop', {
  onNavigate(callback) {
    const listener = (_event, workspace) => callback(workspace)
    ipcRenderer.on('workspace:navigate', listener)
    return () => ipcRenderer.removeListener('workspace:navigate', listener)
  }
})
