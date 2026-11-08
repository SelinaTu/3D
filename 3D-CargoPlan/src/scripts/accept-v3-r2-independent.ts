// #created 11/08/2026
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { loadResearchCalibration, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate, researchHash } from '../core/research-metrics'
import { analyzeStacking } from '../core/packing-utils'
import { nestedInside } from '../core/solid-geometry'
import type { CargoItem, OptimizationConfig, PackingSolution } from '../types/packing'

const input = process.argv[2] ?? 'data/optimization/v3-r2-integrated/front-balanced/best-complete.json'
const phase = process.argv[3] ?? 'initial'
const output = 'data/optimization/v3-r2-independent-acceptance'
const oldPath = 'data/optimization/v3-tail-independent/frozen-complete.json'
const expectedContractHash = '4765ae81a6b1b295bc0dea12293c96781cb7894f993957f2b77c4abd36c2b4c8'
const cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const bytes = fs.readFileSync(input), inputSha256 = createHash('sha256').update(bytes).digest('hex')
const candidate = JSON.parse(bytes.toString('utf8')) as { config: OptimizationConfig; solution: PackingSolution; provenance: { contractSha256?: string } }
const old = JSON.parse(fs.readFileSync(oldPath, 'utf8')) as { solution: PackingSolution }
const assessed = assessResearchCandidate(candidate.solution, cal.items, cal.config)
const baseline = assessResearchCandidate(old.solution, cal.items, cal.config)
const placed = candidate.solution.containers.flatMap(c => c.items)
const originals = new Map(cal.items.map(i => [i.id, i])), ids = placed.map(p => p.item.id)
const unknownIds = ids.filter(id => !originals.has(id)), idSet = new Set(ids)
const missingIds = cal.items.filter(i => !idSet.has(i.id)).map(i => i.id)
const authoritative = candidate.solution.containers.map(c => ({ ...c, items: c.items.map(p => ({ ...p, item: originals.get(p.item.id) ?? p.item })) }))
const sumWeight = placed.reduce((sum, p) => sum + (originals.get(p.item.id)?.weight ?? p.item.weight), 0)
const sheetCounts = cal.items.reduce<Record<string, number>>((counts, item) => { const key = String(item.rawData._sourceSheet); counts[key] = (counts[key] ?? 0) + 1; return counts }, {})
const loadingAudit = authoritative.map(c => {
  const analysis = analyzeStacking(c.items, c.loadingRules)
  const nested = c.items.flatMap(p => c.items.filter(host => host.item.id !== p.item.id && host.item.cavity && nestedInside(p, host)).map(host => ({ id: p.item.id, hostId: host.item.id, orientation: p.orientation, rotation: p.rotation })))
  const racks = c.items.flatMap((p, index) => p.item.rawData._sourceSheet === '玻璃架' ? [{ id: p.item.id, topLoadKg: analysis.topLoads[index], limitKg: 600 }] : [])
  const strictLying = c.items.flatMap((p, index) => p.orientation === 'lying' && p.item.constraints?.orientationRules?.lying?.strictMaxStackWeight ? [{ id: p.item.id, topLoadKg: analysis.topLoads[index], limitKg: p.item.constraints.orientationRules.lying.maxStackWeight }] : [])
  const exceptions = c.items.filter(p => p.position.z + p.actualDimensions.height > 2500 + 1e-6).map(p => ({ id: p.item.id, sourceSheet: p.item.rawData._sourceSheet, sourceRow: p.item.rawData._sourceRow, topZ: p.position.z + p.actualDimensions.height }))
  return { containerId: c.id, itemCount: c.items.length, pairGeometryComparisons: c.items.length * (c.items.length - 1) / 2, totalWeightKg: c.items.reduce((sum, p) => sum + p.item.weight, 0), stackErrors: analysis.errors, racks, strictLying, nested, heightExceptionsUsed: exceptions }
})
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
const checkIdentity = ids.length === 1371 && idSet.size === 1371 && unknownIds.length === 0 && missingIds.length === 0 && placed.every(p => p.item.quantity === 1) && candidate.solution.unpackedItems.length === 0
const checks = {
  frozenContractHash: cal.contractSha256 === expectedContractHash,
  candidateContractHash: candidate.provenance.contractSha256 === expectedContractHash,
  configMatchesContract: researchHash(candidate.config) === cal.configSha256,
  exact1371SourceIds: checkIdentity,
  expectedTotalWeight: near(sumWeight, 134777.37),
  exactSolidVolume: near(assessed.metrics.totalSolidVolumeMm3, 495748311447),
  allGeometryClearanceCavityAndLoadRules: assessed.validation.valid,
  completeEligibleEleven: assessed.metrics.eligible && assessed.metrics.totalContainers === 11,
  oldBaselineAlsoValid: baseline.metrics.eligible,
  strictlySmallerTailThanPriorBest: assessed.metrics.tailSolidVolumeMm3 < baseline.metrics.tailSolidVolumeMm3 - 1,
  strictlyHigherFrontTenMinimumThanPriorBest: (assessed.metrics.front10MinimumSolidUtilization ?? 0) > (baseline.metrics.front10MinimumSolidUtilization ?? 0) + 1e-12,
  actualAllocationChanged: assessed.metrics.allocationSha256 !== baseline.metrics.allocationSha256,
  noAdditionalSupportObjects: unknownIds.length === 0 && idSet.size === cal.items.length,
  heightExceptionsOnlyAuthorizedW02: loadingAudit.flatMap(c => c.heightExceptionsUsed).every(p => p.sourceSheet === '门窗' && p.sourceRow === 16 && near(p.topZ, 2560)),
}
const allChecksPassed = Object.values(checks).every(Boolean)
const engineFiles = ['src/core/research-calibration.ts', 'src/core/research-metrics.ts', 'src/core/packing-utils.ts', 'src/core/solid-geometry.ts', 'src/core/validation.ts', 'src/core/loading-profile.ts'].map(path => ({ path, sha256: researchFileHash(path) }))
const report = {
  schemaVersion: 1, phase, checkedAt: new Date().toISOString(), allChecksPassed,
  scope: 'Independent invocation of the authoritative validator with freshly loaded frozen contract and authoritative source manifest; not an independently implemented solver or physical transport certification.',
  input: { path: input, sha256: inputSha256, physicalLayoutSha256: assessed.metrics.physicalLayoutSha256 },
  provenance: { contractPath: cal.contractPath, contractSha256: cal.contractSha256, manifestSha256: cal.manifestSha256, sourceFiles: cal.sourceFiles, engineFiles, scriptSha256: researchFileHash('src/scripts/accept-v3-r2-independent.ts') },
  checks, identity: { expected: cal.items.length, placed: ids.length, distinct: idSet.size, missingIds, unknownIds, sourceIdSha256: researchHash([...ids].sort()), sourceSheetCounts: sheetCounts, totalWeightKg: sumWeight },
  validation: assessed.validation, metrics: assessed.metrics,
  comparison: { baselinePath: oldPath, baselineSha256: researchFileHash(oldPath), baselineMetrics: baseline.metrics, tailReductionM3: (baseline.metrics.tailSolidVolumeMm3 - assessed.metrics.tailSolidVolumeMm3) / 1e9, tailReductionPercent: (1 - assessed.metrics.tailSolidVolumeMm3 / baseline.metrics.tailSolidVolumeMm3) * 100, frontTenIncreasePercentagePoints: ((assessed.metrics.front10MinimumSolidUtilization ?? 0) - (baseline.metrics.front10MinimumSolidUtilization ?? 0)) * 100, originalPdf: cal.pdfBaseline },
  loadingAudit,
  excludedResults: { macro24: 'data/optimization/v3-r2-eight-seed/macro-24.json is a valid 24-item substructure only; failed global transfers and macro-exchange-diagnostic.json are ineligible and not used in this full 1371-item solution.', globalOptimalityProven: false },
}
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(`${output}/audited-candidate.json`, bytes)
fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2))
const sourceRows = cal.items.reduce<Record<string, CargoItem[]>>((rows, item) => { const key = `${item.rawData._sourceSheet}:${item.rawData._sourceRow}`; (rows[key] ??= []).push(item); return rows }, {})
fs.writeFileSync(`${output}/report.md`, `# 第二轮完整方案独立验收\n\n结论：${allChecksPassed ? '通过' : '未通过'}。本报告重新加载冻结合同和原始清单，独立调用权威校验器重算，没有采用候选内置 valid 标记。\n\n- 候选：\`${input}\`\n- 文件 SHA256：\`${inputSha256}\`\n- 布局 SHA256：\`${assessed.metrics.physicalLayoutSha256}\`\n- 合同 SHA256：\`${cal.contractSha256}\`\n- 验收阶段：${phase}；时间：${report.checkedAt}\n\n| 指标 | 上轮完整解 | 本轮完整解 |\n|---|---:|---:|\n| 柜数 | ${baseline.metrics.totalContainers} | ${assessed.metrics.totalContainers} |\n| 装入/遗漏 | ${baseline.metrics.placedItems}/0 | ${assessed.metrics.placedItems}/${assessed.metrics.unpackedItems} |\n| 排序后尾柜实体体积 | ${(baseline.metrics.tailSolidVolumeMm3 / 1e9).toFixed(8)} m³ | ${(assessed.metrics.tailSolidVolumeMm3 / 1e9).toFixed(8)} m³ |\n| 前10柜最低实体利用率 | ${((baseline.metrics.front10MinimumSolidUtilization ?? 0) * 100).toFixed(6)}% | ${((assessed.metrics.front10MinimumSolidUtilization ?? 0) * 100).toFixed(6)}% |\n\n尾柜减少 ${report.comparison.tailReductionM3.toFixed(8)} m³（${report.comparison.tailReductionPercent.toFixed(4)}%）；前10柜最低利用率增加 ${report.comparison.frontTenIncreasePercentagePoints.toFixed(6)} 个百分点。按排序和实际分配变化比较，排除了仅改柜号的假改善。\n\n清单逐件对应1371个源ID（门窗${sheetCounts['门窗']}、玻璃架${sheetCounts['玻璃架']}、辅材${sheetCounts['辅材']}），涵盖 ${Object.keys(sourceRows).length} 个源表行。总重 ${sumWeight.toFixed(2)} kg，总实体体积 ${(assessed.metrics.totalSolidVolumeMm3 / 1e9).toFixed(9)} m³。重复、缺失、未知ID均为0，无新增木件。\n\n净空仍为11600×2250×2500 mm，仅原W02框使用2560 mm高度例外。重新检查了三轴5 mm间距及架间例外、授权空腔及原宽轴竖直方向、底面真实实体投影和重心凸包、累计载荷、上方单件限重和平放件数。校验错误${assessed.validation.errors.length}条；详细架顶载荷、侧放严格限重、空腔映射和各柜高度例外见JSON。\n\n24件长框macro只是独立合法子结构。该分支未通过的全局迁移和invalid诊断没有被当作完整方案，本次验收只针对上述完整1371件候选。\n\n本结论限于既定几何和载荷假设。保留5 mm空气预留、未加隔垫，不代表现场实际承托和动力运输已验证；没有证明全局最优。\n`)
fs.appendFileSync(`${output}/checks.jsonl`, `${JSON.stringify({ phase, checkedAt: report.checkedAt, inputSha256, physicalLayoutSha256: assessed.metrics.physicalLayoutSha256, allChecksPassed, tailSolidVolumeMm3: assessed.metrics.tailSolidVolumeMm3, front10MinimumSolidUtilization: assessed.metrics.front10MinimumSolidUtilization })}\n`)
console.log(JSON.stringify({ allChecksPassed, phase, inputSha256, physicalLayoutSha256: assessed.metrics.physicalLayoutSha256, checks, tailM3: assessed.metrics.tailSolidVolumeMm3 / 1e9, front10MinimumPercent: (assessed.metrics.front10MinimumSolidUtilization ?? 0) * 100, comparison: { reductionM3: report.comparison.tailReductionM3, increasePoints: report.comparison.frontTenIncreasePercentagePoints } }))
if (!allChecksPassed) process.exitCode = 1
