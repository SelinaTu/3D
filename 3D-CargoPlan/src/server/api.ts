// #created 11/08/2026
import express from 'express'
import { readFileSync } from 'node:fs'
import { JobManager } from './jobs'
import { validateRequest } from './input-validation'
import { DEFAULT_CONFIG } from '../core/optimizer'

export function createApi(jobs: JobManager, dataPath: string) {
  const router = express.Router()
  router.get('/health', (_req, res) => res.json({ success: true, status: 'running', version: '1.1.0', busy: jobs.busy }))
  router.get('/config', (_req, res) => res.json({ success: true, config: DEFAULT_CONFIG }))
  router.get('/load-demo', (_req, res) => {
    try {
      const data = JSON.parse(readFileSync(dataPath, 'utf8'))
      res.json({ success: true, data, total: data.length, message: `已加载 ${data.length} 个货物单元` })
    } catch {
      res.status(500).json({ success: false, error: '随项目提供的示例数据读取失败' })
    }
  })
  router.post('/optimize', (req, res) => {
    try {
      const input = validateRequest(req.body)
      if (jobs.busy) return res.status(429).set('Retry-After', '2').json({ success: false, error: '已有任务正在运行，请等待完成或取消该任务' })
      const job = jobs.start(input.items, input.config, input.compare)
      return res.status(202).json({ success: true, jobId: job.id })
    } catch (error) {
      return res.status(400).json({ success: false, error: error instanceof Error ? error.message : '请求数据无效' })
    }
  })
  router.get('/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id)
    if (!job) return res.status(404).json({ success: false, error: '任务不存在或已过期' })
    return res.json({ success: true, ...job })
  })
  router.delete('/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id)
    if (!job) return res.status(404).json({ success: false, error: '任务不存在或已过期' })
    jobs.cancel(req.params.id)
    return res.json({ success: true, status: job.status })
  })
  router.use((_req, res) => res.status(404).json({ success: false, error: 'API 路径不存在' }))
  return router
}
