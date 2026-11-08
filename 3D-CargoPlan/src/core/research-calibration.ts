// #created 11/08/2026
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { CargoItem, OptimizationConfig } from '../types/packing'
import { normalizeItems } from './greedy-algorithm'
import { loadingRulesFor } from './loading-profile'
import { allocationHash, researchHash, researchInputHash } from './research-metrics'
import type { ResearchMetrics } from './research-metrics'

interface SourceReference { path: string; sha256: string; role?: string }
export interface ResearchCalibration {
  status: 'ready'
  projectRoot: string
  contractPath: string
  contractSha256: string
  calibrationHash: string
  auditPath: string
  auditSha256: string
  manifestPath: string
  manifestSha256: string
  inputSha256: string
  configSha256: string
  sourceFiles: SourceReference[]
  support: { gapMm: 0 | 5; mechanism: 'none' | '5mm-spacer' | 'pdf-clearance-projection'; confirmed: true }
  config: OptimizationConfig
  items: CargoItem[]
  pdfAllocation: { containerNumber: number; ids: string[] }[]
  pdfBaseline: { containerCount: number; originalTailContainerNumber: number; originalTailSolidVolumeMm3: number; permutationInvariantMinSolidVolumeMm3: number; sortedFirstTenMinimumSolidUtilization: number | null; allocationSha256: string }
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
export function researchFileHash(path: string): string { return createHash('sha256').update(readFileSync(path)).digest('hex') }
function checkedFile(value: unknown, root: string, label: string): SourceReference {
  if (!record(value) || typeof value.path !== 'string' || !sha(value.sha256)) throw new Error(`${label} 需要 path 与 SHA256`)
  const path = resolve(root, value.path), actual = researchFileHash(path)
  if (actual.toLowerCase() !== value.sha256.toLowerCase()) throw new Error(`${label} 文件哈希不符: ${value.path}`)
  return { path, sha256: actual, ...(typeof value.role === 'string' ? { role: value.role } : {}) }
}

/** Read-only calibration gate. A ready gate records phase-one closure, not a new approval request. */
export function loadResearchCalibration(contractPath: string, projectRoot = process.cwd()): ResearchCalibration {
  const root = resolve(projectRoot), absoluteContract = resolve(root, contractPath), bytes = readFileSync(absoluteContract)
  const gate: unknown = JSON.parse(bytes.toString('utf8'))
  if (!record(gate) || gate.schemaVersion !== 1) throw new Error('校准 gate 必须使用 schemaVersion: 1')
  if (gate.status !== 'ready') throw new Error('校准阶段尚未完成，研究保持关闭；请先完成 packing-contract 校准记录')
  if (!record(gate.support) || gate.support.confirmed !== true || ![0, 5].includes(Number(gate.support.gapMm)) || typeof gate.support.gapMm !== 'number') throw new Error('校准 gate 缺少已确认的 support.gapMm 声明')
  const gapMm = gate.support.gapMm as 0 | 5, mechanism = gate.support.mechanism as ResearchCalibration['support']['mechanism']
  if (!(gapMm === 0 && mechanism === 'none' || gapMm === 5 && (mechanism === '5mm-spacer' || mechanism === 'pdf-clearance-projection'))) throw new Error('承托间隙与已声明传载/投影模式不一致，禁止假定隔垫')
  if (!record(gate.config) || !record(gate.config.containerDimensions) || !record(gate.config.weights)) throw new Error('校准 gate 缺少完整 config')
  const dims = gate.config.containerDimensions
  if (![dims.length, dims.width, dims.height, gate.config.containerMaxWeight].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)) throw new Error('校准 config 的柜尺寸或载重无效')
  if (!['containerCount', 'volumeUtilization', 'weightBalance', 'stabilityPenalty'].every(key => typeof (gate.config as Record<string, unknown>).weights === 'object' && typeof (gate.config as { weights: Record<string, unknown> }).weights[key] === 'number' && Number.isFinite((gate.config as { weights: Record<string, number> }).weights[key]))) throw new Error('校准 config 缺少有效目标权重')
  if (gate.config.verticalSupport !== mechanism) throw new Error('config.verticalSupport 必须与已确认 support.mechanism 完全一致')
  const config = gate.config as unknown as OptimizationConfig
  const manifest = checkedFile(gate.manifest, root, 'manifest')
  const raw: unknown = JSON.parse(readFileSync(manifest.path, 'utf8'))
  if (!Array.isArray(raw)) throw new Error('manifest 必须是货物数组')
  const items = normalizeItems(raw as CargoItem[])
  if (!Array.isArray(gate.sourceFiles) || !gate.sourceFiles.length) throw new Error('校准 gate 缺少 sourceFiles 原始输入追溯')
  const sourceFiles = gate.sourceFiles.map((file, index) => checkedFile(file, root, `sourceFiles[${index}]`))
  if (typeof gate.auditPath !== 'string') throw new Error('校准 gate 缺少 auditPath')
  const auditPath = resolve(root, gate.auditPath), auditSha256 = researchFileHash(auditPath)
  if (gate.auditSha256 !== undefined && (!sha(gate.auditSha256) || gate.auditSha256.toLowerCase() !== auditSha256)) throw new Error('校准审计文件哈希不符')
  const audit: unknown = JSON.parse(readFileSync(auditPath, 'utf8'))
  if (!record(audit) || audit.schemaVersion !== 1 || audit.status !== 'passed' || !record(audit.checks) || audit.checks.allAssertionsPassed !== true) throw new Error('来源审计尚未全部通过，禁止进入研究')
  if (!record(audit.manifest) || audit.manifest.sha256 !== manifest.sha256) throw new Error('来源审计与研究 manifest 不同')
  if (!record(audit.totals) || audit.totals.totalItems !== items.length) throw new Error('来源审计数量与研究 manifest 不同')
  if (!Array.isArray(audit.sourceFiles)) throw new Error('来源审计缺少 sourceFiles')
  for (const source of sourceFiles) if (!audit.sourceFiles.some(file => record(file) && typeof file.path === 'string' && resolve(root, file.path) === source.path && file.sha256 === source.sha256)) throw new Error(`gate 原始文件没有对应已通过审计记录: ${source.path}`)
  const rules = loadingRulesFor(items, config)
  if ((rules?.supportGapMm ?? 0) !== gapMm) throw new Error('当前引擎承托规则与校准 gate 不一致，禁止手改容器或假定隔垫')
  const contractSha256 = createHash('sha256').update(bytes).digest('hex'), configSha256 = researchHash(config), inputSha256 = researchInputHash(items)
  const calibrationHash = researchHash({ contractSha256, auditSha256, manifestSha256: manifest.sha256, sourceFiles, configSha256, inputSha256 })
  if (!Array.isArray(audit.containers) || !audit.containers.length || !Array.isArray(audit.rows)) throw new Error('来源审计缺少分柜量与逐件映射')
  const auditedContainers = audit.containers.map(c => { if (!record(c) || typeof c.containerNumber !== 'number' || typeof c.materialModelVolumeMm3 !== 'number') throw new Error('来源审计分柜体积无效'); return { containerNumber: c.containerNumber, solid: c.materialModelVolumeMm3 } })
  const originalTail = [...auditedContainers].sort((a, b) => b.containerNumber - a.containerNumber)[0]
  const sorted = [...auditedContainers].sort((a, b) => b.solid - a.solid), capacity = config.containerDimensions.length * config.containerDimensions.width * config.containerDimensions.height
  const pdfAllocation = auditedContainers.map(c => ({ containerNumber: c.containerNumber, ids: (audit.rows as unknown[]).filter(row => record(row) && row.containerNumber === c.containerNumber).flatMap(row => record(row) && Array.isArray(row.normalizedIds) ? row.normalizedIds.filter((id): id is string => typeof id === 'string') : []) }))
  const auditIds = pdfAllocation.flatMap(c => c.ids)
  if (auditIds.length !== items.length || new Set(auditIds).size !== items.length || items.some(item => !auditIds.includes(item.id))) throw new Error('来源审计逐件分柜映射不完整')
  const pdfBaseline = { containerCount: auditedContainers.length, originalTailContainerNumber: originalTail.containerNumber, originalTailSolidVolumeMm3: originalTail.solid, permutationInvariantMinSolidVolumeMm3: sorted.at(-1)!.solid, sortedFirstTenMinimumSolidUtilization: sorted.length >= 10 ? Math.min(...sorted.slice(0, 10).map(c => c.solid / capacity)) : null, allocationSha256: allocationHash(pdfAllocation.map(c => c.ids)) }
  return { status: 'ready', projectRoot: root, contractPath: absoluteContract, contractSha256, calibrationHash, auditPath, auditSha256, manifestPath: manifest.path, manifestSha256: manifest.sha256, inputSha256, configSha256, sourceFiles, support: { gapMm, mechanism, confirmed: true }, config, items, pdfAllocation, pdfBaseline }
}
export function assertResearchCalibration(calibration: ResearchCalibration, items: CargoItem[], config: OptimizationConfig): void {
  if (calibration.status !== 'ready' || calibration.support.confirmed !== true) throw new Error('研究需要已完成的校准 gate')
  if (researchInputHash(items) !== calibration.inputSha256 || researchHash(config) !== calibration.configSha256) throw new Error('研究输入或 config 已偏离已校准口径')
  if (researchFileHash(calibration.contractPath) !== calibration.contractSha256 || researchFileHash(calibration.auditPath) !== calibration.auditSha256 || researchFileHash(calibration.manifestPath) !== calibration.manifestSha256) throw new Error('校准文件在准备后发生变化，请重新读取 gate')
  for (const source of calibration.sourceFiles) if (researchFileHash(source.path) !== source.sha256) throw new Error(`原始输入在准备后发生变化: ${source.path}`)
  if ((loadingRulesFor(items, config)?.supportGapMm ?? 0) !== calibration.support.gapMm) throw new Error('引擎承托规则已偏离 gate')
}
export function researchCalibrationProvenance(calibration: ResearchCalibration) {
  const { items: _items, config: _config, pdfAllocation: _allocation, ...provenance } = calibration
  void _items; void _config; void _allocation
  return provenance
}
export function compareResearchWithPdf(metrics: ResearchMetrics, calibration: ResearchCalibration) {
  const reference = calibration.pdfBaseline, changed = metrics.allocationSha256 !== reference.allocationSha256
  const beatsOriginalLabel = metrics.eligible && metrics.totalContainers === reference.containerCount && metrics.tailSolidVolumeMm3 < reference.originalTailSolidVolumeMm3 - 1
  const beatsSortedMinimum = metrics.eligible && metrics.totalContainers === reference.containerCount && metrics.tailSolidVolumeMm3 < reference.permutationInvariantMinSolidVolumeMm3 - 1
  return { reference, allocationChanged: changed, beatsOriginalTailLabel: beatsOriginalLabel, beatsPermutationInvariantMinimum: beatsSortedMinimum, canClaimTailConsolidation: beatsSortedMinimum && changed, fewerContainers: metrics.eligible && metrics.totalContainers < reference.containerCount, note: 'The PDF audit verifies content and volume, not a replayable physical layout. Renumbering alone is excluded; compare both original tail and invariant minimum.' }
}
export function researchReallocation(solution: import('../types/packing').PackingSolution, calibration: ResearchCalibration) {
  const original = new Map(calibration.pdfAllocation.flatMap(c => c.ids.map(id => [id, c.containerNumber] as const)))
  return solution.containers.map(c => ({ candidateContainerId: c.id, items: c.items.map(p => ({ id: p.item.id, originalPdfContainerNumber: original.get(p.item.id) ?? null })) }))
}
