// #created 11/08/2026
import type { CargoItem, Container, OptimizationConfig, PackingSolution, PlacedItem } from '../types/packing'
import { createEmptyContainer, deadlineFor, normalizeItems, orderedByVolume } from './greedy-algorithm'
import { calculateActualDimensions, canPlaceAt, tryPlaceItem, updateContainer } from './packing-utils'
import { createPackingSolution } from './solution-builder'
import { calculateSolutionScore } from './evaluator'
import { validateSolution } from './validation'
import { cargoReviewReasons } from './cargo-readiness'
import type { PackingProgressCallback } from './packing-progress'

/** Repair an audited complete plan using authoritative new item data and the same vehicle contract. */
export function repairPacking(items: CargoItem[], config: OptimizationConfig, seed: PackingSolution, onProgress?: PackingProgressCallback): PackingSolution | null {
  const start = Date.now(), deadline = deadlineFor(config), units = normalizeItems(items)
  const oldUnits = [...seed.containers.flatMap(c => c.items.map(p => p.item)), ...seed.unpackedItems]
  if (seed.unpackedItems.length || !seed.containers.length || !validateSolution(seed, oldUnits).valid) return null
  const byId = new Map(units.map(item => [item.id, item]))
  if (seed.totalItems && oldUnits.filter(item => byId.has(item.id)).length / seed.totalItems < 0.75) return null
  const containers: Container[] = [], retainedIds = new Set<string>()
  let rebuilt = 0, preserved = 0
  for (const [index, previous] of seed.containers.entries()) {
    const container = createEmptyContainer(index, config, units)
    container.id = previous.id
    const proposed = previous.items.flatMap(placed => {
      const item = byId.get(placed.item.id)
      if (!item) return []
      const actualDimensions = calculateActualDimensions(item.dimensions,placed.orientation,placed.rotation,item.orientationVerticalAxes)
      return [{ ...placed, item, position: { ...placed.position }, actualDimensions }]
    })
    container.items = proposed; updateContainer(container)
    const inContainer = new Set(proposed.map(p => p.item.id))
    const elsewhere = units.filter(item => !inContainer.has(item.id))
    const check = createPackingSolution([container], elsewhere, 'REPAIR-CHECK', 0, 0)
    if (proposed.length && validateSolution(check, units, config).valid) {
      containers.push(container); proposed.forEach(p => retainedIds.add(p.item.id)); preserved++
      onProgress?.({processed:retainedIds.size,total:units.length,containers:containers.length,placed:retainedIds.size,unpacked:0})
      continue
    }
    rebuilt++
    container.items = []; updateContainer(container)
    // Reinsert lower surfaces first. A rejected item remains pending for repacking.
    const order = [...proposed].sort((a,b) => a.position.z - b.position.z || Number(!a.item.cavity) - Number(!b.item.cavity) || a.item.id.localeCompare(b.item.id))
    for (const placed of order) {
      if (Date.now() >= deadline) break
      if (canPlaceAt(placed.item,placed.position,placed.orientation,placed.rotation,container)) {
        container.items.push(placed); updateContainer(container); retainedIds.add(placed.item.id)
      }
    }
    if (container.items.length) containers.push(container)
    onProgress?.({processed:retainedIds.size,total:units.length,containers:containers.length,placed:retainedIds.size,unpacked:0})
  }
  const pending = orderedByVolume(units.filter(item => !retainedIds.has(item.id))), unpacked: CargoItem[] = []
  const usedIds = new Set(containers.map(c => c.id))
  let nextId = seed.containers.length
  for (const [index,item] of pending.entries()) {
    if (Date.now() >= deadline) { unpacked.push(...pending.slice(index)); break }
    const review = cargoReviewReasons(item)
    if (review.length) { unpacked.push({ ...item, constraints: { ...item.constraints, requiresManualReview: review } }); onProgress?.({processed:retainedIds.size+index+1,total:units.length,containers:containers.length,placed:retainedIds.size+index+1-unpacked.length,unpacked:unpacked.length});continue }
    let placement: PlacedItem | null = null, target: Container | undefined
    // Share the remaining budget across pending items and candidate bays. A hard
    // insertion must not consume every later item's chance to be considered.
    const itemDeadline=Math.min(deadline,Date.now()+Math.max(10,(deadline-Date.now())/(pending.length-index)))
    for (const [bayIndex,c] of containers.entries()) {
      if (Date.now() >= itemDeadline) break
      const bayDeadline=Math.min(itemDeadline,Date.now()+Math.max(2,(itemDeadline-Date.now())/(containers.length-bayIndex+1)))
      placement = tryPlaceItem(item,c,bayDeadline)
      if (placement) { target = c; break }
    }
    if (!placement && Date.now() < deadline) {
      do { nextId++ } while (usedIds.has(`container-${nextId}`))
      const c = createEmptyContainer(nextId - 1, config, units)
      placement = tryPlaceItem(item,c,deadline)
      if (placement) { target = c; containers.push(c); usedIds.add(c.id) }
    }
    if (placement && target) { target.items.push(placement); updateContainer(target) }
    else unpacked.push(item)
    onProgress?.({processed:retainedIds.size+index+1,total:units.length,containers:containers.length,placed:retainedIds.size+index+1-unpacked.length,unpacked:unpacked.length})
  }
  const result = createPackingSolution(containers,unpacked,'REPAIR-EXISTING',calculateSolutionScore(containers,unpacked,config.containerDimensions,config.weights),Date.now()-start)
  result.searchMode = 'heuristic'; result.terminationReason = Date.now() >= deadline ? 'time-limit' : 'completed'
  result.notes = [`基于已校验的 ${seed.totalContainers} 柜方案进行局部修复：${preserved} 柜保留原有位置，${rebuilt} 柜重新检查和调整；未找到位置的货物列入未装载。`, '此结果是有限时间的启发式方案，不保证柜数或利用率全局最优。']
  result.validation = validateSolution(result,units,config)
  return result.validation.valid ? result : null
}
