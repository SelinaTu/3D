// #created 11/08/2026
import type { CargoItem, PackingSolution, OptimizationConfig } from '../types/packing'
import { greedyPackingFFD, greedyPackingBFD, deadlineFor, normalizeItems } from './greedy-algorithm'
import { geneticAlgorithm, hybridAlgorithm } from './genetic-algorithm'
import { tabuSearch } from './tabu-search'
import { antColonyOptimization } from './ant-colony'
import { branchAndBound } from './branch-bound'
import { compareSolutions } from './evaluator'
import { validateSolution } from './validation'
import type { PackingProgressCallback } from './packing-progress'

export type ProgressCallback = (data: { algorithm: string; progress: number; message: string; currentStep?: number; totalSteps?: number }) => void

export const DEFAULT_CONFIG: OptimizationConfig = {
  containerDimensions: { length: 12032, width: 2352, height: 2698 }, containerMaxWeight: 28000,
  weights: { containerCount: 1000, volumeUtilization: 500, weightBalance: 200, stabilityPenalty: 300 },
  algorithm: 'hybrid', timeLimit: 30000, populationSize: 12, generations: 30
}
function checked(items: CargoItem[], config: OptimizationConfig): CargoItem[] {
  if (![config.containerDimensions.length, config.containerDimensions.width, config.containerDimensions.height, config.containerMaxWeight].every(n => Number.isFinite(n) && n > 0)) throw new Error('集装箱尺寸和最大载重必须是正数 (mm/kg)')
  if (config.timeLimit !== undefined && (!Number.isFinite(config.timeLimit) || config.timeLimit < 0)) throw new Error('timeLimit 必须是非负毫秒数')
  if (config.clearanceMm !== undefined && (!Number.isFinite(config.clearanceMm) || config.clearanceMm < 0 || config.clearanceMm > 1000 || config.loadingProfile === 'villa-pdf')) throw new Error('clearanceMm 须为 0–1000 mm 且仅用于自定义装载模型')
  if (config.unloadingDoor !== undefined && !['x-min','x-max'].includes(config.unloadingDoor)) throw new Error('unloadingDoor 必须为 x-min 或 x-max')
  if (config.unloadingDoor && items.some(item => item.unloadStop === undefined)) throw new Error('启用站点分析时每件货物都必须提供 unloadStop')
  if (config.preventCrossStopStacking !== undefined && typeof config.preventCrossStopStacking !== 'boolean') throw new Error('preventCrossStopStacking 必须是布尔值')
  if (config.preventCrossStopStacking && !config.unloadingDoor) throw new Error('禁止跨站叠放须先启用站点分析')
  return normalizeItems(items)
}
export function optimize(items: CargoItem[], config: OptimizationConfig, onProgress?: PackingProgressCallback): PackingSolution {
  const start = Date.now(), units = checked(items, config), bounded = { ...config, deadline: deadlineFor(config) }
  let solution: PackingSolution
  switch (config.algorithm) {
    case 'greedy': solution = greedyPackingFFD(units, bounded, onProgress); break
    case 'genetic': solution = geneticAlgorithm(units, bounded); break
    case 'tabu': solution = tabuSearch(units, bounded); break
    case 'ant-colony': solution = antColonyOptimization(units, bounded); break
    case 'branch-bound': solution = branchAndBound(units, bounded); break
    case 'hybrid': solution = hybridAlgorithm(units, bounded); break
    case 'simulated-annealing': solution = tabuSearch(units, bounded); solution.notes = [...(solution.notes ?? []), '旧 simulated-annealing 参数兼容映射至禁忌搜索；未实现模拟退火。']; break
    case 'compare': throw new Error('compare 请使用 optimizeMultiple 接口')
    default: throw new Error(`未知算法: ${String(config.algorithm)}`)
  }
  solution.computeTime = Date.now() - start
  if (solution.stats) solution.stats.executionTime = solution.computeTime
  solution.validation = validateSolution(solution, units, config)
  return solution
}
/** Every algorithm shares one wall-clock budget; exhausted jobs are explicitly skipped. */
export async function optimizeMultiple(items: CargoItem[], config: OptimizationConfig, onProgress?: ProgressCallback): Promise<PackingSolution[]> {
  const units = checked(items, config), deadline = deadlineFor(config), solutions: PackingSolution[] = []
  let incumbent: PackingSolution | undefined
  const algorithms: [string, (items: CargoItem[], config: OptimizationConfig) => PackingSolution][] = [
    ['GREEDY-FFD', greedyPackingFFD], ['HYBRID', (i, c) => hybridAlgorithm(i, c, incumbent)], ['GREEDY-BFD', greedyPackingBFD], ['GENETIC', (i, c) => geneticAlgorithm(i, c, incumbent)], ['TABU-SEARCH', (i, c) => tabuSearch(i, c, undefined, incumbent)], ['ANT-COLONY', (i, c) => antColonyOptimization(i, c, undefined, incumbent)], ['BRANCH-BOUND', (i, c) => branchAndBound(i, c, incumbent)]
  ]
  for (let i = 0; i < algorithms.length; i++) {
    const [name, run] = algorithms[i]
    if (i > 0 && Date.now() >= deadline) { onProgress?.({ algorithm: name, progress: i / algorithms.length * 100, message: `${name} 跳过：总计算预算已用尽`, currentStep: i + 1, totalSteps: algorithms.length }); continue }
    onProgress?.({ algorithm: name, progress: i / algorithms.length * 100, message: `正在执行 ${name}`, currentStep: i + 1, totalSteps: algorithms.length })
    // FFD establishes a feasible incumbent first. Later algorithms divide remaining budget.
    const slice = i === 0 ? deadline - Date.now() : name === 'HYBRID' ? (deadline - Date.now()) / 2 : (deadline - Date.now()) / (algorithms.length - i)
    const algorithmDeadline = Math.min(deadline, Date.now() + Math.max(0, slice))
    let solution = run(units, { ...config, timeLimit: Math.max(0, algorithmDeadline - Date.now()), deadline: algorithmDeadline })
    if (incumbent && solution.containers === incumbent.containers) solution.notes = [...(solution.notes ?? []), `本轮 ${name} 未改善共享 ${incumbent.algorithm} 可行基线，保留同一装载布局。`]
    if (incumbent && compareSolutions(incumbent, solution) < 0) solution = { ...incumbent, id: solution.id, algorithm: solution.algorithm, computeTime: solution.computeTime, searchMode: solution.searchMode, terminationReason: solution.terminationReason, notes: [...(incumbent.notes ?? []), `${name} 本轮候选有 ${solution.unpackedItems.length} 件未装载且未改善结果，已放弃该候选；返回共享 ${incumbent.algorithm} 可行基线（最终 ${incumbent.unpackedItems.length} 件未装载）。`] }
    if (solution.stats) solution.stats = { ...solution.stats, executionTime: solution.computeTime }
    if (!incumbent || compareSolutions(solution, incumbent) < 0) incumbent = solution
    solution.validation = validateSolution(solution, units, config)
    solutions.push(solution)
    onProgress?.({ algorithm: name, progress: (i + 1) / algorithms.length * 100, message: `${name} 完成：${solution.totalContainers} 箱，${solution.unpackedItems.length} 件未装载`, currentStep: i + 1, totalSteps: algorithms.length })
  }
  onProgress?.({ algorithm: 'ALL', progress: 100, message: `已完成 ${solutions.length} 种算法；结果已完成独立校验并排序` })
  return solutions.sort((a, b) => Number(b.validation?.valid) - Number(a.validation?.valid) || compareSolutions(a, b))
}
