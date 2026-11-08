// #created 11/08/2026
import { Worker } from 'node:worker_threads'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import type { CargoItem, OptimizationConfig, PackingSolution } from '../types/packing'

export interface Job {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: { progress: number; message: string; algorithm: string }
  createdAt: string
  finishedAt?: string
  solutions?: PackingSolution[]
  error?: string
}

export class JobManager {
  private jobs = new Map<string, Job>()
  private workers = new Map<string, Worker>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  get busy() { return this.workers.size >= 1 }
  get(id: string) { this.prune(); return this.jobs.get(id) }
  private prune() {
    for (const [id, job] of this.jobs) {
      if (job.finishedAt && Date.now() - Date.parse(job.finishedAt) > 30 * 60 * 1000) this.jobs.delete(id)
    }
    const finished = [...this.jobs.values()].filter(j => j.finishedAt)
    for (const j of finished.slice(0, Math.max(0, finished.length - 5))) this.jobs.delete(j.id)
  }
  start(items: CargoItem[], config: OptimizationConfig, compare: boolean): Job {
    if (this.busy) throw new Error('已有优化任务正在运行')
    this.prune()
    const job: Job = { id: randomUUID(), status: 'queued', progress: { progress: 0, message: '正在启动优化线程', algorithm: '' }, createdAt: new Date().toISOString() }
    this.jobs.set(job.id, job)
    const compiled = new URL('./optimization-worker.js', import.meta.url)
    const worker = new Worker(existsSync(compiled) ? compiled : new URL('./worker-bootstrap.mjs', import.meta.url), { workerData: { items, config, compare } })
    this.workers.set(job.id, worker)
    job.status = 'running'
    const finish = (status: Job['status'], error?: string) => {
      if (job.finishedAt) return
      job.status = status
      job.error = error
      job.finishedAt = new Date().toISOString()
      clearTimeout(this.timers.get(job.id))
      this.timers.delete(job.id)
      this.workers.delete(job.id)
      void worker.terminate()
    }
    worker.on('message', message => {
      if (job.finishedAt) return
      if (message.type === 'progress') job.progress = message.data
      else if (message.type === 'complete') {
        job.solutions = message.solutions
        job.progress = { progress: 100, message: '优化及约束校验完成', algorithm: 'ALL' }
        finish('completed')
      } else if (message.type === 'failed') finish('failed', message.error)
    })
    worker.on('error', err => finish('failed', err.message))
    worker.on('exit', code => { if (!job.finishedAt) finish('failed', `优化线程提前退出 (${code})`) })
    this.timers.set(job.id, setTimeout(() => finish('failed', '优化超过时间预算，请减少货物数量或增加时间预算'), (config.timeLimit ?? 30000) + 15000))
    return job
  }
  cancel(id: string): boolean {
    const job = this.jobs.get(id)
    if (!job || job.finishedAt) return false
    job.status = 'cancelled'
    job.finishedAt = new Date().toISOString()
    job.progress.message = '任务已取消'
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
    const worker = this.workers.get(id)
    this.workers.delete(id)
    if (worker) void worker.terminate()
    return true
  }
  close() { for (const id of this.workers.keys()) this.cancel(id) }
}
