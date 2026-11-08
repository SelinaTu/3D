// #created 11/08/2026
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Server } from 'node:http'
import { createApp } from './index'
import { validateRequest } from './input-validation'
import { DEFAULT_CONFIG } from '../core/optimizer'
import type { CargoItem } from '../types/packing'

const item: CargoItem = { id: 'test-1', name: '测试货物', category: '箱', dimensions: { length: 100, width: 100, height: 100 }, weight: 10, quantity: 1, allowedOrientations: ['standing'], canStackOnTop: true, hasGlass: false, canOffsetStack: false, colorTag: '蓝色', rawData: {} }
const { app, jobs } = createApp()
let server: Server
let base: string
beforeAll(async () => {
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', () => resolve()) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('测试服务器启动失败')
  base = `http://127.0.0.1:${address.port}`
})
afterAll(async () => { jobs.close(); await new Promise<void>(resolve => server?.close(() => resolve())) })

describe('API delivery contract', () => {
  it('serves bundled data and health without machine-specific paths', async () => {
    expect((await (await fetch(`${base}/api/health`)).json()).status).toBe('running')
    const response = await fetch(`${base}/api/load-demo`)
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.total).toBeGreaterThan(1196)
    expect(validateRequest({ items: payload.data }).items.length).toBe(payload.total)
  })
  it('rejects malformed JSON and invalid input with useful errors', async () => {
    const invalid = await fetch(`${base}/api/optimize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{invalid' })
    expect(invalid.status).toBe(400)
    expect((await invalid.json()).error).toContain('JSON')
    const empty = await fetch(`${base}/api/optimize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [] }) })
    expect(empty.status).toBe(400)
    expect((await empty.json()).error).toContain('货物')
  })
  it('keeps jobs isolated, responds during compute, and supports cancellation', async () => {
    const response = await fetch(`${base}/api/optimize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [item], config: { ...DEFAULT_CONFIG, algorithm: 'compare', timeLimit: 1000 } }) })
    expect(response.status).toBe(202)
    const { jobId } = await response.json()
    expect((await fetch(`${base}/api/health`)).status).toBe(200)
    const cancelled = await fetch(`${base}/api/jobs/${jobId}`, { method: 'DELETE' })
    expect(cancelled.status).toBe(200)
    const job = await (await fetch(`${base}/api/jobs/${jobId}`)).json()
    expect(['cancelled', 'completed']).toContain(job.status)
    expect((await fetch(`${base}/api/jobs/nonexistent`)).status).toBe(404)
  })
})

describe('request validation', () => {
  it.each([
    { items: [{ ...item, dimensions: { length: 0, width: 1, height: 1 } }] },
    { items: [item, item] },
    { items: [{ ...item, weight: -1 }] },
    { items: [{ ...item, quantity: 2 }] },
    { items: [{ ...item, rawData: null }] },
    { items: [{ ...item, forbiddenOrientations: ['standing'] }] },
    { items: [item], config: { timeLimit: 0 } },
    { items: [item], config: { algorithm: 'invented' } },
    { items: [item], config: { containerMaxWeight: 0 } }
  ])('rejects invalid payload %#', body => expect(() => validateRequest(body)).toThrow())
  it('merges partial configuration while preserving valid defaults', () => {
    const parsed = validateRequest({ items: [item], config: { algorithm: 'greedy', containerMaxWeight: 100 } })
    expect(parsed.config.containerMaxWeight).toBe(100)
    expect(parsed.config.containerDimensions).toEqual(DEFAULT_CONFIG.containerDimensions)
    expect(parsed.compare).toBe(false)
  })
})
