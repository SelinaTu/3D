// #created 11/08/2026
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import type { PackingSolution } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { researchHash } from '../core/research-metrics'
import { createPackingSolution } from '../core/solution-builder'
import { loadingRulesFor } from '../core/loading-profile'
import { validateSolution } from '../core/validation'

// Keep fixed-allocation completion separate from an explicit recorded decision to research global reallocation.
const started = performance.now(), cpuStarted = process.cpuUsage()
const contract = process.argv[2] ?? 'data/reconstruction/model-v3-contract.json'
const calibration = loadResearchCalibration(contract)
const output = resolve('data/reconstruction'), sources: string[] = []
function collect(directory: string, depth = 0) {
  if (!existsSync(directory) || depth > 3) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) collect(path, depth + 1)
    else if (entry.name === 'result.json' || /^container-\d+\.json$/.test(entry.name)) sources.push(path)
  }
}
collect(resolve('data/reconstruction'))
collect(resolve('delivery-output/reconstruction'))
type Attempt = { path: string; sha256: string; sourceContainerNumber: number; sameModel: boolean; fixedAllocation: boolean; loaded: number; expected: number; unpacked: number; independentlyValid: boolean; complete: boolean; errors: string[]; solution: PackingSolution }
const candidates: Attempt[] = [], rejectedFiles: { path: string; reason: string }[] = []
for (const path of sources.sort()) {
  try {
    const file = JSON.parse(readFileSync(path, 'utf8'))
    if (!file.solution || !Number.isInteger(file.sourceContainerNumber)) continue
    const allocation = calibration.pdfAllocation.find(c => c.containerNumber === file.sourceContainerNumber)
    if (!allocation) continue
    const sameModel = researchHash(file.config) === calibration.configSha256 && file.provenance?.calibrationHash === calibration.calibrationHash
    const solution: PackingSolution = file.solution
    const allowed = new Set(allocation.ids), placed = solution.containers.flatMap(c => c.items.map(p => p.item.id))
    const accounted = [...placed, ...solution.unpackedItems.map(i => i.id)]
    const fixedAllocation = solution.containers.length === 1 && accounted.length === allowed.size && new Set(accounted).size === allowed.size && accounted.every(id => allowed.has(id))
    const items = allocation.ids.map(id => calibration.items.find(i => i.id === id)!)
    const validation = sameModel && fixedAllocation ? validateSolution(solution, items, calibration.config) : null
    candidates.push({ path: relative(process.cwd(), path), sha256: researchFileHash(path), sourceContainerNumber: allocation.containerNumber, sameModel, fixedAllocation, loaded: placed.length, expected: items.length, unpacked: solution.unpackedItems.length, independentlyValid: validation?.valid ?? false, complete: sameModel && fixedAllocation && validation?.valid === true && solution.unpackedItems.length === 0 && placed.length === items.length, errors: validation?.errors ?? ['Model provenance or fixed allocation did not match; candidate excluded'], solution })
  } catch (error) { rejectedFiles.push({ path: relative(process.cwd(), path), reason: error instanceof Error ? error.message : String(error) }) }
}
const selected = calibration.pdfAllocation.map(allocation => candidates.filter(c => c.sourceContainerNumber === allocation.containerNumber && c.sameModel && c.fixedAllocation && c.independentlyValid).sort((a, b) => Number(b.complete) - Number(a.complete) || b.loaded - a.loaded || a.path.localeCompare(b.path))[0])
const allComplete = selected.length === 11 && selected.every(c => c?.complete)
let combinedValidation: ReturnType<typeof validateSolution> | null = null
let combined: PackingSolution | null = null
if (allComplete) {
  const containers = selected.map((candidate, i) => ({ ...structuredClone(candidate!.solution.containers[0]), id: `pdf-container-${i + 1}`, loadingRules: loadingRulesFor(calibration.items, calibration.config) }))
  combined = createPackingSolution(containers, [], 'PDF-ELEVEN-FIXED-ALLOCATION-REPLAY', 0, 0)
  combinedValidation = validateSolution(combined, calibration.items, calibration.config)
  combined.validation = combinedValidation
}
const gate = allComplete && combinedValidation?.valid === true
const workflowPath = 'data/reconstruction/workflow.json'
const workflow = existsSync(workflowPath) ? JSON.parse(readFileSync(workflowPath, 'utf8')) : null
const globalOptimizationAuthorized = workflow?.globalReallocationAuthorized === true && workflow.calibrationHash === calibration.calibrationHash
const workflowRecord = globalOptimizationAuthorized ? { path: workflowPath, sha256: researchFileHash(workflowPath), decisionSource: workflow.decisionSource, originalReplayGateSatisfied: gate } : null
const supportCriterion = calibration.config.supportCriterion ?? 'area-80-centroid'
const certificatePath = 'data/reconstruction/container-eight-v2-certificate/certificate.json'
const certificate = existsSync(certificatePath) ? JSON.parse(readFileSync(certificatePath, 'utf8')) : null
const modelConflict = certificate?.status === 'conditionally-infeasible' && certificate.provenance?.calibrationHash === calibration.calibrationHash && certificate.checks.every((c: { passed: boolean }) => c.passed) && certificate.provenance.engineFiles.every((file: { path: string; sha256: string }) => existsSync(file.path) && researchFileHash(file.path) === file.sha256)
  ? { certificatePath, certificateSha256: researchFileHash(certificatePath), sourceContainerNumber: 8, scope: certificate.scope, supportAreaFraction: certificate.supportAreaFraction, floorMinimumM2: certificate.floorCertificate.minimumFloorAreaMm2 / 1e6, floorAvailableM2: certificate.floorCertificate.availableFloorAreaMm2 / 1e6, consequence: 'Stop searching this unchanged fixed allocation. Resolve the explicit model difference before dependent reconstruction or tuning.' } : null
const engineFiles = ['src/scripts/audit-pdf-replay.ts', 'src/core/packing-utils.ts', 'src/core/solid-geometry.ts', 'src/core/validation.ts', 'src/core/loading-profile.ts', 'src/core/greedy-algorithm.ts', 'src/core/research-calibration.ts'].map(path => ({ path, sha256: researchFileHash(path) }))
const omitSolution = ({ solution: _solution, ...rest }: Attempt) => { void _solution; return rest }
const status = {
  schemaVersion: 1, checkedAt: new Date().toISOString(), phase: gate ? 'replay-complete-ready-for-tuning' : globalOptimizationAuthorized ? 'global-rearrangement-with-incomplete-fixed-replay' : modelConflict ? 'fixed-allocation-conditionally-infeasible' : 'manual-replay-incomplete', optimizationUnlocked: gate || globalOptimizationAuthorized, fixedReplayGateSatisfied: gate, globalOptimizationAuthorized, workflowRecord, supportCriterion, modelConflict,
  replayDefinition: 'Original per-container unit identities, newly constructed coordinates, same explicit model, independent validation; exact raster-hidden original XYZ not recovered.',
  contract, provenance: researchCalibrationProvenance(calibration), engineFiles, engineSha256: researchHash(engineFiles),
  counts: { expectedContainers: 11, completeContainers: selected.filter(c => c?.complete).length, selectedLoaded: selected.reduce((s, c) => s + (c?.loaded ?? 0), 0), expectedUnits: calibration.items.length },
  containers: calibration.pdfAllocation.map((allocation, index) => ({ sourceContainerNumber: allocation.containerNumber, expected: allocation.ids.length, selected: selected[index] ? omitSolution(selected[index]!) : null })),
  candidates: candidates.map(omitSolution), rejectedFiles, combinedValidation,
  execution: { command: `node --import tsx src/scripts/audit-pdf-replay.ts ${contract}`, elapsedMs: Math.round(performance.now() - started), cpuMicroseconds: process.cpuUsage(cpuStarted), nodeVersion: process.version },
  optimality: { established: false, reason: gate ? 'A feasible upper bound does not prove global optimality' : globalOptimizationAuthorized ? 'Global heuristic research is authorized; fixed-allocation replay remains incomplete and no optimum is established' : 'The fixed-allocation replay gate is still incomplete; no tuning result is claimed' }
}
mkdirSync(output, { recursive: true })
function atomicJSON(name: string, value: unknown) { const path = resolve(output, name); writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2)); renameSync(`${path}.tmp`, path) }
atomicJSON('replay-status.json', status)
const table = status.containers.map(c => `| ${c.sourceContainerNumber} | ${c.selected?.loaded ?? 0} / ${c.expected} | ${c.selected?.unpacked ?? c.expected} | ${c.selected?.complete ? '完整通过' : '未完成'} | ${c.selected ? `[坐标与尝试来源](../../${c.selected.path})` : '暂无同版本合法候选'} |`).join('\n')
writeFileSync(resolve(output, 'REPLAY_PROGRESS.md'), `# 原 PDF 固定 11 柜复现进度\n\n审计时间：${status.checkedAt}。模型合同：\`${contract}\`。\n\n**完整通过 ${status.counts.completeContainers}/11 柜；当前各柜最好合法候选合计放入 ${status.counts.selectedLoaded}/${status.counts.expectedUnits} 件，仍缺 ${status.counts.expectedUnits - status.counts.selectedLoaded} 件。** 部分候选校验通过只表示已装子集合法，不构成完整方案。${gate ? '固定配货复现门槛已满足。' : globalOptimizationAuthorized ? '固定配货复现尚未全部通过；已按单独工作流记录转入全局跨柜重排研究。' : '优化阶段尚未开启。'}全局最优尚未证明。\n\n${modelConflict ? '**已定位条件冲突：** 原第8柜固定配货在本次审计的旧模型（含80%承托工程下限）下条件不可行。解析必要条件给出地板需求至少${modelConflict.floorMinimumM2}m²，超过${modelConflict.floorAvailableM2}m²，详见 [条件证明](container-eight-v2-certificate/PROOF.md)。这不是对原PDF现场方案的否定，也没有排除重新分配货物后的11/10柜。此证明不适用于显式取消80%比例下限的v3模型。\n\n' : ''}| 原柜号 | 放入 / 原配货 | 未装 | 状态 | 可复查结果 |\n| --- | ---: | ---: | --- | --- |\n${table}\n\n复现定义：原 PDF 每柜货物身份集合不变，重新构造逐件坐标后按同一显式模型独立校验；PDF 的栅格图未提供原始 XYZ，不能称原坐标已经恢复。\n\n输入对账已完成：1371 件、134777.37 kg。净空、W02 高度例外、三轴留缝、孔内原宽轴竖直及源表载荷限制均保留。${supportCriterion === 'centroid-hull' ? '用户已确认取消额外80%底材承托比例下限；当前仍要求正实体承托投影、重心投影位于支撑凸包内，并保留全部源载荷及叠放限制。' : '本次审计的旧模型保留80%底材承托工程假设；它不是原文件规定的数值，不适用于当前v3研究结论。'}\n\n完整机器审计见 [replay-status.json](replay-status.json)；阶段与参数事件见 [process-journal.jsonl](process-journal.jsonl)。${globalOptimizationAuthorized ? '全局重排的决策、原复现未完成状态及目标见 [workflow.json](workflow.json)；本页逐柜数字仅属于固定配货复现，不是全局候选成绩。' : ''}输入及候选均记录 SHA256，逐件构造记录接受点与拒绝原因。\n\n本次审计耗时 ${status.execution.elapsedMs} ms；Node ${status.execution.nodeVersion}。本页由 \`src/scripts/audit-pdf-replay.ts\` 生成，后续复验会刷新状态。\n`)
if (gate && combined) atomicJSON('eleven-container-replay.json', { config: calibration.config, solution: combined, validation: combinedValidation, provenance: status.provenance, constituentResults: selected.map(c => ({ path: c!.path, sha256: c!.sha256 })), engineFiles, engineSha256: status.engineSha256 })
appendFileSync(resolve(output, 'process-journal.jsonl'), `${JSON.stringify({ event: 'independent-fixed-allocation-audit', at: status.checkedAt, contract, calibrationHash: calibration.calibrationHash, engineSha256: status.engineSha256, ...status.counts, optimizationUnlocked: status.optimizationUnlocked, fixedReplayGateSatisfied: gate, globalOptimizationAuthorized, workflowRecord, execution: status.execution })}\n`)
console.log(JSON.stringify({ ...status.counts, optimizationUnlocked: status.optimizationUnlocked, fixedReplayGateSatisfied: gate, globalOptimizationAuthorized, output: relative(process.cwd(), resolve(output, 'replay-status.json')), selected: status.containers.map(c => ({ sourceContainerNumber: c.sourceContainerNumber, loaded: c.selected?.loaded ?? 0, expected: c.expected, complete: c.selected?.complete ?? false })) }))
