// #created 11/08/2026
import path from 'node:path'
import { createApp } from '../dist-server/index.js'
const { app, jobs } = createApp({ staticPath: path.join(process.argv[2], 'dist'), dataPath: path.join(process.argv[2], 'data/demo-items.json') })
const server = app.listen(0, '127.0.0.1', () => {
  process.parentPort.postMessage({ type: 'ready', port: server.address().port })
})
server.on('error', error => { console.error(error); process.exit(1) })
process.parentPort.on('message', ({ data }) => {
  if (data === 'shutdown') {
    jobs.close()
    server.close(() => process.exit(0))
    server.closeAllConnections()
  }
})
