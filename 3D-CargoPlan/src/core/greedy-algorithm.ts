// #created 11/08/2026
import type { CargoItem, Container, OptimizationConfig, PackingSolution } from '../types/packing'
import { tryPlaceItem, updateContainer, volume } from './packing-utils'
import { createPackingSolution } from './solution-builder'
import { calculateSolutionScore, compareSolutions } from './evaluator'
import { loadingRulesFor } from './loading-profile'
import { cargoReviewReasons } from './cargo-readiness'
import type { PackingProgressCallback } from './packing-progress'

export function normalizeItems(items: CargoItem[]): CargoItem[] {
  const ids = new Set<string>(), result: CargoItem[] = []
  for (const item of items) {
    if (!item.id || ids.has(item.id)) throw new Error(`货物 ID 必须唯一: ${item.id}`)
    ids.add(item.id)
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error(`${item.id}: quantity 必须是正整数`)
    if (item.unloadStop !== undefined && (!Number.isSafeInteger(item.unloadStop) || item.unloadStop < 1)) throw new Error(`${item.id}: unloadStop 必须是正整数`)
    const c = item.constraints
    if (c?.horizontalRotations && (!c.horizontalRotations.length || c.horizontalRotations.some(value => ![0, 90, 180, 270].includes(value)))) throw new Error(`${item.id}: 水平旋转无效`)
    if (c?.onlySameMixGroup && !c.mixGroup?.trim()) throw new Error(`${item.id}: 启用同组混装时必须指定混装组`)
    if (![item.dimensions.length, item.dimensions.width, item.dimensions.height].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(item.weight) || item.weight < 0) throw new Error(`${item.id}: 尺寸必须为正数，重量不得为负 (mm/kg)`)
    for (let i = 0; i < item.quantity; i++) result.push({ ...item, id: item.quantity === 1 ? item.id : `${item.id}::${i + 1}`, quantity: 1 })
  }
  if (new Set(result.map(i => i.id)).size !== result.length) throw new Error('数量展开后存在重复货物 ID')
  return result
}
export function deadlineFor(config: OptimizationConfig): number { return Math.min(config.deadline ?? Infinity, Date.now() + (config.timeLimit ?? 30000)) }
export function createEmptyContainer(index: number, config: OptimizationConfig, items: CargoItem[] = []): Container {
  return { id: `container-${index + 1}`, dimensions: { ...config.containerDimensions }, maxWeight: config.containerMaxWeight, ...(config.unloadingDoor ? { unloadingDoor: config.unloadingDoor } : {}), loadingRules: loadingRulesFor(items, config), items: [], totalWeight: 0, volumeUtilization: 0, weightUtilization: 0 }
}
/** Decoder deliberately preserves input order so search chromosomes affect placements. */
export function packInOrder(items: CargoItem[], config: OptimizationConfig, bestFit = false, algorithm = 'ordered-decoder', onProgress?: PackingProgressCallback): PackingSolution {
  const start = Date.now(), deadline = deadlineFor(config), containers: Container[] = [], unpacked: CargoItem[] = []
  let timedOut = false
  for (let i = 0; i < items.length; i++) {
    if (Date.now() >= deadline) { unpacked.push(...items.slice(i)); timedOut = true; break }
    const item = items[i]
    const review = cargoReviewReasons(item)
    if (review.length) { unpacked.push({ ...item, constraints: { ...item.constraints, requiresManualReview: review } });onProgress?.({processed:i+1,total:items.length,containers:containers.length,placed:i+1-unpacked.length,unpacked:unpacked.length});continue }
    let selected: Container | undefined, placement: ReturnType<typeof tryPlaceItem> = null, bestRemaining = Infinity
    for (const container of containers) {
      if (Date.now() >= deadline) break
      const candidate = tryPlaceItem(item, container, deadline)
      if (candidate) {
        const remaining = volume(container.dimensions) * (1 - container.volumeUtilization) - volume(candidate.actualDimensions)
        if (!bestFit || remaining < bestRemaining) { selected = container; placement = candidate; bestRemaining = remaining }
        if (!bestFit) break
      }
    }
    if (!placement && Date.now() < deadline) {
      const empty = createEmptyContainer(containers.length, config, items)
      placement = tryPlaceItem(item, empty, deadline)
      if (placement) { containers.push(empty); selected = empty }
    }
    if (placement && selected) { selected.items.push(placement); updateContainer(selected) }
    else unpacked.push(item)
    onProgress?.({processed:i+1,total:items.length,containers:containers.length,placed:i+1-unpacked.length,unpacked:unpacked.length})
  }
  const solution = createPackingSolution(containers, unpacked, algorithm, calculateSolutionScore(containers, unpacked, config.containerDimensions, config.weights), Date.now() - start)
  solution.searchMode = 'heuristic'; solution.terminationReason = timedOut || Date.now() >= deadline ? 'time-limit' : 'completed'
  if (solution.terminationReason === 'time-limit') solution.notes = ['达到计算时限；剩余货物已计入未装载清单。']
  return solution
}
export function orderedByVolume(items: CargoItem[]): CargoItem[] { return [...items].sort((a, b) => volume(b.dimensions) - volume(a.dimensions) || b.weight - a.weight || a.id.localeCompare(b.id)) }
function greedyWithStops(items: CargoItem[], config: OptimizationConfig, bestFit: boolean, name: string, onProgress?: PackingProgressCallback): PackingSolution {
  const units = normalizeItems(items), deadline = deadlineFor(config), bounded = { ...config, deadline }
  const best = packInOrder(orderedByVolume(units), bounded, bestFit, name, onProgress)
  if (!config.unloadingDoor || Date.now() >= deadline) return best
  // Candidate positions start at x-min. Place early deliveries there for x-min doors.
  const direction = config.unloadingDoor === 'x-min' ? 1 : -1
  const byStop = [...units].sort((a, b) => direction * (a.unloadStop! - b.unloadStop!) || volume(b.dimensions) - volume(a.dimensions) || a.id.localeCompare(b.id))
  const candidate = packInOrder(byStop, bounded, bestFit, name, onProgress)
  const selected = compareSolutions(candidate, best) < 0 ? candidate : best
  selected.notes = [...(selected.notes ?? []), '比较体积优先与站点优先两种贪心顺序；阻挡仅为几何风险信号。']
  return selected
}
export function greedyPackingFFD(items: CargoItem[], config: OptimizationConfig, onProgress?: PackingProgressCallback): PackingSolution { return greedyWithStops(items, config, false, 'GREEDY-FFD', onProgress) }
export function greedyPackingBFD(items: CargoItem[], config: OptimizationConfig, onProgress?: PackingProgressCallback): PackingSolution { return greedyWithStops(items, config, true, 'GREEDY-BFD', onProgress) }
