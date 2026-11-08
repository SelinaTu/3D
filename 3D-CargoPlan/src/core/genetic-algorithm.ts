// #created 11/08/2026
import type { CargoItem, PackingSolution, OptimizationConfig } from '../types/packing'
import { deadlineFor, normalizeItems, orderedByVolume, packInOrder } from './greedy-algorithm'
import { compareSolutions } from './evaluator'
import { better, finishSearch, randomFor, shuffled, swapOrder, withDeadline } from './search-utils'
import { tabuSearch } from './tabu-search'
import { orientationsFor, volume } from './packing-utils'

/** Ordering features only: every decoded placement still uses all hard checks. */
function deterministicOrders(items: CargoItem[], config: OptimizationConfig): [string, CargoItem[]][] {
  const features = new Map(items.map(item => {
    const variants = orientationsFor(item).filter(v => v.dimensions.height <= config.containerDimensions.height &&
      ((v.dimensions.length <= config.containerDimensions.length && v.dimensions.width <= config.containerDimensions.width) ||
       (v.dimensions.width <= config.containerDimensions.length && v.dimensions.length <= config.containerDimensions.width)))
    return [item.id, { flexibility: variants.length, footprint: Math.min(...variants.map(v => v.dimensions.length * v.dimensions.width)) }] as const
  }))
  return [
    ['受限方向优先', [...items].sort((a, b) => features.get(a.id)!.flexibility - features.get(b.id)!.flexibility || volume(b.dimensions) - volume(a.dimensions))],
    ['可行底面积优先', [...items].sort((a, b) => features.get(b.id)!.footprint - features.get(a.id)!.footprint || volume(b.dimensions) - volume(a.dimensions))]
  ]
}

/** Order crossover preserves each physical ID exactly once. */
export function orderCrossover(a: CargoItem[], b: CargoItem[], start: number, end: number): CargoItem[] {
  if (!a.length) return []
  const child: (CargoItem | undefined)[] = Array(a.length).fill(undefined), used = new Set<string>()
  for (let i = start; i <= end; i++) { child[i] = a[i]; used.add(a[i].id) }
  const remaining = b.filter(i => !used.has(i.id))
  let index = 0
  return child.map(i => i ?? remaining[index++])
}
export function geneticAlgorithm(items: CargoItem[], config: OptimizationConfig, seed?: PackingSolution): PackingSolution {
  const start = Date.now(), deadline = deadlineFor(config), units = normalizeItems(items), random = randomFor(units)
  const initialOrder = orderedByVolume(units)
  let best = seed ?? packInOrder(initialOrder, withDeadline(config, deadline), false, 'GENETIC')
  if (units.length < 2 || Date.now() >= deadline) return finishSearch(best, 'GENETIC', start, deadline)
  type Individual = { order: CargoItem[]; solution: PackingSolution }
  let population: Individual[] = [{ order: initialOrder, solution: best }]
  const size = Math.max(2, Math.min(60, config.populationSize ?? 12)), generations = Math.max(0, Math.min(500, config.generations ?? 30))
  for (let i = 1; i < size && Date.now() < deadline; i++) {
    const order = i === 1 ? [...initialOrder].sort((a, b) => b.weight - a.weight) : shuffled(initialOrder, random)
    const solution = packInOrder(order, withDeadline(config, deadline))
    population.push({ order, solution }); if (better(solution, best)) best = solution
  }
  for (let generation = 0; generation < generations && Date.now() < deadline; generation++) {
    population.sort((a, b) => compareSolutions(a.solution, b.solution))
    const next = population.slice(0, Math.max(1, Math.floor(population.length / 5)))
    const select = () => { const a = population[Math.floor(random() * population.length)], b = population[Math.floor(random() * population.length)]; return better(a.solution, b.solution) ? a : b }
    while (next.length < size && Date.now() < deadline) {
      const a = select(), b = select(), left = Math.floor(random() * units.length), right = left + Math.floor(random() * (units.length - left))
      let order = orderCrossover(a.order, b.order, left, right)
      if (random() < 0.35) order = swapOrder(order, Math.floor(random() * order.length), Math.floor(random() * order.length))
      const solution = packInOrder(order, withDeadline(config, deadline))
      next.push({ order, solution }); if (better(solution, best)) best = solution
    }
    population = next
  }
  return finishSearch(best, 'GENETIC', start, deadline)
}
export function hybridAlgorithm(items: CargoItem[], config: OptimizationConfig, seed?: PackingSolution): PackingSolution {
  const start = Date.now(), deadline = deadlineFor(config)
  const units = normalizeItems(items), trials: string[] = []
  let best = seed
  const orders = deterministicOrders(units, config)
  if (!seed) orders.push(['体积优先', orderedByVolume(units)])
  for (const [name, order] of orders) {
    if (Date.now() >= deadline) break
    const candidate = packInOrder(order, withDeadline(config, deadline))
    trials.push(`${name}：${candidate.totalContainers} 箱，${candidate.unpackedItems.length} 件未装载${candidate.terminationReason === 'time-limit' ? '（时限中断）' : ''}`)
    if (!best || better(candidate, best)) best = candidate
  }
  best ??= packInOrder(units, withDeadline(config, deadline))
  if (Date.now() < deadline) {
    const evolved = geneticAlgorithm(units, withDeadline(config, Date.now() + (deadline - Date.now()) * 0.65), best)
    if (better(evolved, best)) best = evolved
  }
  if (Date.now() < deadline) {
    const order = [...best.containers.flatMap(c => c.items.map(p => p.item)), ...best.unpackedItems]
    const refined = tabuSearch(order, withDeadline(config, deadline), { maxIterations: 30, tabuTenure: 7, maxNoImprove: 10 }, best)
    if (better(refined, best)) best = refined
  }
  return finishSearch(best, 'HYBRID', start, deadline, 'heuristic', [...trials, '先比较受限方向及可行底面积的确定性排列，再在剩余预算内执行遗传和禁忌搜索；不保证全局最优。'])
}
