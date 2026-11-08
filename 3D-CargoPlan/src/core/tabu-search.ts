// #created 11/08/2026
import type { CargoItem, OptimizationConfig, PackingSolution } from '../types/packing'
import { deadlineFor, normalizeItems, orderedByVolume, packInOrder } from './greedy-algorithm'
import { better, finishSearch, randomFor, swapOrder, withDeadline } from './search-utils'

export function tabuSearch(items: CargoItem[], config: OptimizationConfig, options = { maxIterations: 60, tabuTenure: 7, maxNoImprove: 15 }, seed?: PackingSolution): PackingSolution {
  const start = Date.now(), deadline = deadlineFor(config), units = normalizeItems(items), random = randomFor(units)
  let order = seed ? [...units] : orderedByVolume(units)
  let current = seed ?? packInOrder(order, withDeadline(config, deadline)), best = current, noImprove = 0
  const tabu = new Map<string, number>()
  for (let iteration = 0; iteration < options.maxIterations && noImprove < options.maxNoImprove && Date.now() < deadline && order.length > 1; iteration++) {
    let chosen: { order: CargoItem[]; solution: PackingSolution; key: string } | undefined
    for (let n = 0; n < Math.min(10, order.length * 2) && Date.now() < deadline; n++) {
      const i = Math.floor(random() * order.length), j = (i + 1 + Math.floor(random() * (order.length - 1))) % order.length
      const key = [order[i].id, order[j].id].sort().join('|'), neighbor = swapOrder(order, i, j)
      const solution = packInOrder(neighbor, withDeadline(config, deadline))
      if ((tabu.get(key) ?? -1) > iteration && !better(solution, best)) continue
      if (!chosen || better(solution, chosen.solution)) chosen = { order: neighbor, solution, key }
    }
    if (!chosen) break
    order = chosen.order; current = chosen.solution; tabu.set(chosen.key, iteration + Math.max(1, options.tabuTenure))
    for (const [key, expires] of tabu) if (expires <= iteration) tabu.delete(key)
    if (better(current, best)) { best = current; noImprove = 0 } else noImprove++
  }
  return finishSearch(best, 'TABU-SEARCH', start, deadline)
}
