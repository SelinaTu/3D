// #created 11/08/2026
import express from 'express'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createApi } from './api'
import { JobManager } from './jobs'

const here = path.dirname(fileURLToPath(import.meta.url))
export const projectRoot = path.resolve(here, here.endsWith('dist-server') ? '..' : '../..')

export function createApp(options: { jobs?: JobManager; dataPath?: string; staticPath?: string } = {}) {
  const app = express()
  const jobs = options.jobs ?? new JobManager()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '20mb' }))
  // Only proxy the fixed loopback knowledge service, after checking its identity.
  app.get('/api/knowledge/search', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 500) : ''
    if (!query) return res.status(400).json({ error: '请输入检索问题' })
    try {
      const base = 'http://127.0.0.1:18765'
      const statusResponse = await fetch(`${base}/api/status`, { signal: AbortSignal.timeout(3000) })
      const status = await statusResponse.json() as { application_id?: string }
      if (!statusResponse.ok || status.application_id !== (process.env.CARGOPLAN_KNOWLEDGE_APP_ID || 'cargoplan-knowledgebase')) throw new Error('identity mismatch')
      const params = new URLSearchParams({ q: query, limit: '6' })
      const upstream = await fetch(`${base}/api/search?${params}`, { signal: AbortSignal.timeout(30000) })
      if (!upstream.ok) throw new Error('search failed')
      const data = await upstream.json() as {results?: Record<string, unknown>[]; notes_zh?: string[]; resolved_port_id?: string | null}
      const results = (data.results ?? []).map(({ source_id, source_title, page, url, knowledge_layer_label, scope_note_zh, review_status, source_role }) => ({ source_id, source_title, page, url, knowledge_layer_label, scope_note_zh, review_status, source_role }))
      return res.json({ results, notes_zh: data.notes_zh ?? [], resolved_port_id: data.resolved_port_id ?? null })
    } catch {
      return res.status(503).json({ error: '本地原文知识库不可用，请启动 CargoPlan_KnowledgeBase（端口 18765）。' })
    }
  })
  app.use('/api', createApi(jobs, options.dataPath ?? path.join(projectRoot, 'data/demo-items.json')))
  const staticPath = options.staticPath ?? path.join(projectRoot, 'dist')
  if (existsSync(path.join(staticPath, 'index.html'))) {
    app.use(express.static(staticPath))
    app.get('/', (_req, res) => res.sendFile(path.join(staticPath, 'index.html')))
  } else {
    app.get('/', (_req, res) => res.type('text').send('开发模式：运行 npm run dev 并打开 http://localhost:5173；生产模式：先运行 npm run build。'))
  }
  app.use((_req, res) => res.status(404).json({ success: false, error: '路径不存在' }))
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500
    res.status(status).json({ success: false, error: status === 413 ? '请求过大（最大 20MB）' : status === 400 ? 'JSON 格式无效' : '服务器处理失败' })
  })
  return { app, jobs }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { app, jobs } = createApp()
  const port = Number(process.env.PORT ?? 3001)
  const host = process.env.HOST ?? '127.0.0.1'
  const server = app.listen(port, host, () => { const address = server.address(); console.log(`装箱优化系统 http://${host}:${address && typeof address !== 'string' ? address.port : port}`) })
  server.on('error', error => { console.error(error.message); process.exitCode = 1 })
  const shutdown = () => { jobs.close(); server.close(() => process.exit(0)) }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
