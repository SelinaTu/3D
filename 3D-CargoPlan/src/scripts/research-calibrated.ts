// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { loadResearchCalibration, researchCalibrationProvenance, compareResearchWithPdf } from '../core/research-calibration'
import { assessResearchCandidate } from '../core/research-metrics'
import { runTargetResearch } from '../core/target-search'
import type { PackingSolution } from '../types/packing'
import type { ResearchMetrics } from '../core/research-metrics'

/** Default mode only prepares provenance and objectives. It never runs the decoder. */
function main() {
  const args = process.argv.slice(2), options = new Map<string, string>(), run = args.includes('--run')
  if (args.includes('--help')) { console.log('node --import tsx src/scripts/research-calibrated.ts [--contract data/calibration/packing-contract.json] [--output delivery-output/research/calibrated] [--baseline solution.json] [--seed 88371] [--cpu-budget-ms 600000] [--candidate-limit-ms 60000] [--max-trials 70] [--run]\nDefault: prepare only. --run requires the already-authorized calibration gate to be ready with an explicit confirmed support mechanism.'); return }
  const allowed = new Set(['--contract', '--output', '--baseline', '--seed', '--cpu-budget-ms', '--candidate-limit-ms', '--max-trials'])
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run') continue
    if (!allowed.has(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`参数无效: ${args[i]}`)
    options.set(args[i], args[++i])
  }
  const contractPath = options.get('--contract') ?? 'data/calibration/packing-contract.json'
  let calibration: ReturnType<typeof loadResearchCalibration>
  try { calibration = loadResearchCalibration(contractPath) } catch (error) {
    if (run) throw error
    console.log(JSON.stringify({ mode: 'prepare', status: 'blocked', optimizationStarted: false, contractPath, reason: error instanceof Error ? error.message : String(error) }, null, 2)); return
  }
  const number = (name: string, fallback: number, max: number) => { const raw = options.get(name); const value = raw === undefined ? fallback : /^\d+$/.test(raw) ? Number(raw) : NaN; if (!Number.isSafeInteger(value) || value < (name === '--seed' ? 0 : 1) || value > max) throw new Error(`${name} 超出范围`); return value }
  const seed = number('--seed', 88371, 0xffffffff), cpuBudgetMs = number('--cpu-budget-ms', 600000, 600000), candidateTimeLimitMs = number('--candidate-limit-ms', 60000, 60000), maxTrials = number('--max-trials', 70, 100)
  const outputDir = resolve(options.get('--output') ?? join('delivery-output/research', `calibrated-${calibration.calibrationHash.slice(0, 12)}-seed-${seed}`))
  let baseline: PackingSolution | undefined
  if (options.has('--baseline')) {
    const data = JSON.parse(readFileSync(resolve(options.get('--baseline')!), 'utf8')); baseline = data.solution ?? data
    const assessed = assessResearchCandidate(baseline!, calibration.items, calibration.config)
    if (!assessed.metrics.eligible) throw new Error('指定基线未通过同口径完整校验；请省略 --baseline，让第二阶段建立首份完整基线')
  }
  const plan = { mode: run ? 'research' : 'prepare', status: 'ready', optimizationStarted: false, provenance: researchCalibrationProvenance(calibration), config: calibration.config, seed, cpuBudgetMs, candidateTimeLimitMs, maxTrials, baseline: baseline ? { metrics: assessResearchCandidate(baseline, calibration.items, calibration.config).metrics, pdfComparison: compareResearchWithPdf(assessResearchCandidate(baseline, calibration.items, calibration.config).metrics, calibration) } : null, objective: ['完整且带config的独立校验通过', '更少柜数', '同11柜按实体体积降序规范编号并最小化尾柜实体体积', '尾柜相同时最大化前10柜最小实体占用率'], pdfComparison: '同时保留原第11柜和原排序最小柜参照；仅重编号不计改善；附实体、外包络合计、包围盒及逐件重新分配记录', baselinePolicy: '没有完整基线不阻断已校准研究；第一个完整且独立valid的候选保存为不可变基线。' }
  mkdirSync(outputDir, { recursive: true }); writeFileSync(join(outputDir, 'research-plan.json'), JSON.stringify(plan, null, 2))
  if (!run) { console.log(JSON.stringify({ ...plan, outputDir }, null, 2)); return }
  console.log(JSON.stringify({ event: 'research-started', calibrationHash: calibration.calibrationHash, outputDir }))
  runTargetResearch(calibration.items, calibration.config, { calibration, baseline, outputDir, seed, cpuBudgetMs, candidateTimeLimitMs, maxTrials }, record => {
    const metrics = record.metrics as ResearchMetrics | undefined
    console.log(JSON.stringify(metrics ? { event: record.event, trialIndex: record.trialIndex, name: record.name, candidateMs: record.candidateMs, totalMs: record.totalMs, containers: metrics.totalContainers, placed: metrics.placedItems, unpacked: metrics.unpackedItems, valid: metrics.independentlyValid, eligible: metrics.eligible, tailSolidM3: metrics.tailSolidVolumeMm3 / 1e9, front10MinSolidUtilization: metrics.front10MinimumSolidUtilization, improved: record.improved, pdfComparison: record.pdfComparison } : record))
  })
}
try { main() } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
