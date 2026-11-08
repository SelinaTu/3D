// #created 11/08/2026
import type { CargoItem, OptimizationConfig, PackingSolution } from '../types/packing'
import { deadlineFor, normalizeItems, orderedByVolume, packInOrder } from './greedy-algorithm'
import { volume } from './packing-utils'
import { better, finishSearch, randomFor, withDeadline } from './search-utils'

export function antColonyOptimization(items: CargoItem[], config: OptimizationConfig, options = { antCount: 8, iterations: 20, alpha: 1, beta: 2, evaporationRate: 0.3, q: 100 }, seed?: PackingSolution): PackingSolution {
  const start = Date.now(), deadline = deadlineFor(config), units = normalizeItems(items), random = randomFor(units)
  let best = seed ?? packInOrder(orderedByVolume(units), withDeadline(config, deadline)), bestOrder = orderedByVolume(units)
  const pheromone = new Map<string, number>(), index = new Map(units.map((item, i) => [item.id, i]))
  const maxVolume = Math.max(1, ...units.map(i => volume(i.dimensions)))
  const heuristic = units.map(i => 0.1 + volume(i.dimensions) / maxVolume)
  let previous = -1
  const deposit = (order: CargoItem[], quality: number) => {
    previous = -1
    for (const item of order) { const next = index.get(item.id)!, key = `${previous}/${next}`; pheromone.set(key, Math.min(1000, (pheromone.get(key) ?? 1) + quality)); previous = next }
  }
  deposit(bestOrder, 1)
  for (let iteration = 0; iteration < Math.min(100, options.iterations) && Date.now() < deadline && units.length > 1; iteration++) {
    for (let ant = 0; ant < Math.min(30, options.antCount) && Date.now() < deadline; ant++) {
      const remaining = units.map((_, i) => i), order: CargoItem[] = []; previous = -1
      while (remaining.length && Date.now() < deadline) {
        const desirability = remaining.map(i => Math.pow(pheromone.get(`${previous}/${i}`) ?? 1, options.alpha) * Math.pow(heuristic[i], options.beta))
        let threshold = random() * desirability.reduce((a, b) => a + b, 0), chosen = remaining.length - 1
        for (let i = 0; i < desirability.length; i++) { threshold -= desirability[i]; if (threshold <= 0) { chosen = i; break } }
        previous = remaining.splice(chosen, 1)[0]; order.push(units[previous])
      }
      if (order.length !== units.length) break
      const solution = packInOrder(order, withDeadline(config, deadline))
      if (better(solution, best)) { best = solution; bestOrder = order }
      deposit(order, options.q / (1 + solution.totalContainers + solution.unpackedItems.length * units.length))
    }
    const evaporation = Math.max(0, Math.min(1, options.evaporationRate))
    for (const [key, value] of pheromone) pheromone.set(key, Math.max(0.05, value * (1 - evaporation)))
    deposit(bestOrder, options.q / (1 + best.totalContainers + best.unpackedItems.length * units.length))
  }
  return finishSearch(best, 'ANT-COLONY', start, deadline)
}
