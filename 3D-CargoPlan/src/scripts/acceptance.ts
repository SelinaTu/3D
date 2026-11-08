// #created 11/08/2026
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import XLSX from '../core/xlsx-adapter'
import { buildSolutionJSON, buildSolutionReport, buildSolutionWorkbook } from '../core/export-utils'
import type { PackingSolution } from '../types/packing'

// Exercise the compiled production server and worker, not a mocked optimizer.
const { createApp } = await import(pathToFileURL(path.resolve('dist-server/index.js')).href)
const { app, jobs } = createApp()
const server = app.listen(0, '127.0.0.1')
await new Promise<void>(resolve => server.once('listening', resolve))
const address = server.address()
if (!address || typeof address === 'string') throw new Error('验收服务器启动失败')
const base = `http://127.0.0.1:${address.port}`
const output = path.resolve('delivery-output')
mkdirSync(output, { recursive: true })
const startedAt = Date.now()
const checks: string[] = []

try {
  const homepage = await fetch(base)
  assert.equal(homepage.status, 200)
  assert.match(await homepage.text(), /<div id="root">/)
  checks.push('生产页面及静态资源入口可访问')
  const demo = await (await fetch(`${base}/api/load-demo`)).json()
  assert.equal(demo.total, 1371)
  assert.equal(new Set(demo.data.map((i: { id: string }) => i.id)).size, demo.total)
  checks.push(`完整三表清单 ${demo.total} 件，ID 唯一`)

  const submit = await fetch(`${base}/api/optimize`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: demo.data, config: { algorithm: 'compare', timeLimit: 60000, populationSize: 8, generations: 10 } })
  })
  const submitted = await submit.json()
  assert.equal(submit.status, 202, submitted.error)
  const healthStart = Date.now()
  assert.equal((await fetch(`${base}/api/health`)).status, 200)
  const healthMs = Date.now() - healthStart
  assert.ok(healthMs < 2000, `计算时健康检查耗时 ${healthMs}ms`)
  checks.push(`计算期间主服务保持响应（健康检查 ${healthMs}ms）`)
  const expiresAt = Date.now() + 85000
  let result
  while (Date.now() < expiresAt) {
    result = await (await fetch(`${base}/api/jobs/${submitted.jobId}`)).json()
    if (result.status === 'completed' || result.status === 'failed') break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.equal(result?.status, 'completed', result?.error ?? '等待计算超时')
  const solutions = result.solutions as PackingSolution[]
  assert.ok(solutions.length > 0)
  for (const solution of solutions) {
    assert.equal(solution.validation?.valid, true)
    assert.equal(solution.containers.reduce((sum, c) => sum + c.items.length, 0) + solution.unpackedItems.length, demo.total)
    assert.equal(solution.unpackedItems.length, 0, `${solution.algorithm} 未完整装载内置样例`)
    assert.equal(solution.containers.reduce((sum, c) => sum + c.items.length, 0), demo.total)
    assert.equal(solution.totalContainers, solution.containers.length)
    for (const container of solution.containers) {
      assert.deepEqual(container.dimensions, { length: 12032, width: 2352, height: 2698 })
      assert.equal(container.maxWeight, 28000)
    }
  }
  checks.push(`${solutions.length} 个真实方案通过边界、碰撞、重量、堆叠和完整记账校验`)
  const best = solutions[0]
  assert.ok(best.totalContainers <= 11, `完整样例质量回归：当前 ${best.totalContainers} 柜，期望不超过 11 柜`)
  writeFileSync(path.join(output, 'solutions.json'), JSON.stringify(solutions, null, 2))
  writeFileSync(path.join(output, 'packing-solution.json'), buildSolutionJSON(best))
  writeFileSync(path.join(output, 'packing-report.html'), buildSolutionReport(best))
  writeFileSync(path.join(output, 'packing-manifest.xlsx'), XLSX.write(buildSolutionWorkbook(best), { bookType: 'xlsx', type: 'buffer' }))
  const workbook = XLSX.read(readFileSync(path.join(output, 'packing-manifest.xlsx')), { type: 'buffer' })
  assert.ok(workbook.SheetNames.length >= 2)
  checks.push('JSON、Excel 逐件清单、HTML 打印报告生成并回读')
  const summary = {
    verifiedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, checks,
    dataUnits: demo.total, healthDuringComputeMs: healthMs,
    results: solutions.map(s => ({ algorithm: s.algorithm, containers: s.totalContainers, loaded: s.containers.reduce((sum, c) => sum + c.items.length, 0), unpacked: s.unpackedItems.length, volumeUtilization: s.avgVolumeUtilization, weightUtilization: s.avgWeightUtilization, valid: s.validation?.valid, warnings: s.validation?.warnings, computeTimeMs: s.computeTime, terminationReason: s.terminationReason, searchMode: s.searchMode }))
  }
  writeFileSync(path.join(output, 'acceptance.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
} finally {
  jobs.close()
  await new Promise<void>(resolve => server.close(() => resolve()))
}
