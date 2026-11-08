// #created 11/08/2026
import type { CargoItem, Container, OptimizationConfig, PackingSolution, PlacedItem } from '../types/packing'
import { createEmptyContainer, deadlineFor, normalizeItems, orderedByVolume, packInOrder } from './greedy-algorithm'
import { canPlaceAt, findPlacementPoints, orientationsFor, tryPlaceItem, updateContainer, volume } from './packing-utils'
import { createPackingSolution } from './solution-builder'
import { calculateSolutionScore } from './evaluator'
import { better, finishSearch, withDeadline } from './search-utils'

/** Bounded placement-tree search. Discrete points and node caps never imply global optimality. */
export function branchAndBound(items: CargoItem[], config: OptimizationConfig, seed?: PackingSolution): PackingSolution {
  const start = Date.now(), deadline = deadlineFor(config), units = orderedByVolume(normalizeItems(items))
  let best = seed ?? packInOrder(units, withDeadline(config, deadline), false, 'BRANCH-BOUND')
  if (units.length > 12) return { ...finishSearch(best, 'BRANCH-BOUND', start, deadline, 'bounded-search'), terminationReason: Date.now() >= deadline ? 'time-limit' : 'size-limit', notes: ['超过 12 件时仅保留已有可行基线；未执行指数规模的分支树搜索。'] }
  const empty = createEmptyContainer(0, config, units), impossible: CargoItem[] = [], searchable: CargoItem[] = []
  for (const item of units) (item.constraints?.requiresManualReview?.length || !tryPlaceItem(item, empty) ? impossible : searchable).push(item)
  let nodes = 0, capped = false
  const globalLowerBound = Math.max(Math.ceil(searchable.reduce((s, i) => s + volume(i.dimensions), 0) / volume(config.containerDimensions)), Math.ceil(searchable.reduce((s, i) => s + i.weight, 0) / config.containerMaxWeight))
  const visit = (depth: number, containers: Container[]) => {
    if (Date.now() >= deadline || ++nodes > 12000) { capped = true; return }
    if (containers.length > best.totalContainers && best.unpackedItems.length === impossible.length) return
    if (depth === searchable.length) {
      const solution = createPackingSolution(containers, impossible, 'BRANCH-BOUND', calculateSolutionScore(containers, impossible, config.containerDimensions, config.weights), Date.now() - start)
      if (better(solution, best)) best = solution
      return
    }
    if (best.unpackedItems.length === impossible.length && best.totalContainers === globalLowerBound) return
    const item = searchable[depth]
    const candidates: { containerIndex: number; placement: PlacedItem }[] = []
    for (let ci = 0; ci <= containers.length && Date.now() < deadline; ci++) {
      if (ci === containers.length && containers.length >= best.totalContainers && best.unpackedItems.length === impossible.length) break
      const container = containers[ci] ?? createEmptyContainer(ci, config, units)
      let added = 0
      for (const position of findPlacementPoints(container)) {
        if (Date.now() >= deadline || added >= 12) break
        for (const variant of orientationsFor(item)) {
          if (canPlaceAt(item, position, variant.orientation, variant.rotation, container)) {
            candidates.push({ containerIndex: ci, placement: { item, position, orientation: variant.orientation, rotation: variant.rotation, actualDimensions: variant.dimensions } }); added++
            if (added >= 12) break
          }
        }
      }
    }
    for (const candidate of candidates) {
      if (Date.now() >= deadline || capped) break
      const next = containers.map(c => ({ ...c, items: [...c.items] }))
      if (candidate.containerIndex === next.length) next.push(createEmptyContainer(next.length, config, units))
      const target = next[candidate.containerIndex]; target.items.push(candidate.placement); updateContainer(target)
      visit(depth + 1, next)
    }
  }
  visit(0, [])
  const result = finishSearch(best, 'BRANCH-BOUND', start, deadline, 'bounded-search', [`候选位置树搜索 ${nodes} 个节点；每箱每件最多 12 个位置分支；不保证全局最优。`])
  if (!capped && Date.now() < deadline) result.terminationReason = 'completed'
  return result
}
