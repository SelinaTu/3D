// #created 11/08/2026
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import type { CargoItem, Container, PackingSolution, PlacedItem, Position3D } from '../types/packing'
import { orientationsFor, tryPlaceItem, canPlaceAt, updateContainer, volume, findPlacementPoints } from '../core/packing-utils'
import { createPackingSolution } from '../core/solution-builder'
import { calculateSolutionScore } from '../core/evaluator'
import { validateSolution } from '../core/validation'

const baseline = JSON.parse(readFileSync('delivery-output/packing-solution.json', 'utf8')) as PackingSolution
const inputs = JSON.parse(readFileSync('data/demo-items.json', 'utf8')) as CargoItem[]
const budget = Number(process.argv[2] || 120000)
const stop = Date.now() + budget
mkdirSync('delivery-output/research', { recursive: true })
const trials: unknown[] = []
function extraPlacement(item: CargoItem, container: Container, until: number): PlacedItem | null {
  const base = tryPlaceItem(item, container, until)
  if (base) return base
  const wall = container.dimensions
  for (const variant of orientationsFor(item)) {
    const d = variant.dimensions, seen = new Set<string>()
    const positions: Position3D[] = []
    const add = (x: number, y: number, z: number) => {
      if (x < 0 || y < 0 || z < 0 || x + d.length > wall.length || y + d.width > wall.width || z + d.height > wall.height) return
      const key = `${x}/${y}/${z}`
      if (!seen.has(key)) { seen.add(key); positions.push({ x, y, z }) }
    }
    add(wall.length - d.length, 0, 0); add(0, wall.width - d.width, 0); add(wall.length - d.length, wall.width - d.width, 0)
    for (const p of container.items) {
      const x = p.position.x, y = p.position.y, z = p.position.z, q = p.actualDimensions
      const x2 = x + q.length, y2 = y + q.width, z2 = z + q.height
      for (const [cx, cy] of [[x2, y - d.width], [x - d.length, y2], [x2 - d.length, y2], [x2, y2 - d.width], [x2, wall.width - d.width], [wall.length - d.length, y2], [x - d.length, 0], [0, y - d.width]]) add(cx, cy, 0)
      if (p.item.canStackOnTop) for (const cx of [x, x2 - d.length]) for (const cy of [y, y2 - d.width]) add(cx, cy, z2)
    }
    // Project existing extreme points toward opposite walls, retaining their support level.
    for (const p of findPlacementPoints(container)) { add(wall.length - d.length, p.y, p.z); add(p.x, wall.width - d.width, p.z) }
    positions.sort((a,b) => a.z - b.z || a.x - b.x || a.y - b.y)
    for (const position of positions) {
      if (Date.now() >= until) return null
      if (canPlaceAt(item, position, variant.orientation, variant.rotation, container)) return { item, position, orientation: variant.orientation, rotation: variant.rotation, actualDimensions: d }
    }
  }
  return null
}
function orderItems(items: CargoItem[], mode: number) {
  const sorted = [...items]
  sorted.sort((a,b) => {
    if (mode === 0) return orientationsFor(a).length - orientationsFor(b).length || volume(b.dimensions)-volume(a.dimensions)
    if (mode === 1) return Math.max(...Object.values(b.dimensions)) - Math.max(...Object.values(a.dimensions)) || volume(b.dimensions)-volume(a.dimensions)
    return volume(b.dimensions)-volume(a.dimensions)
  })
  return sorted
}
let bestUnpacked = Infinity
for (const removedIndex of [10, 7, 0, 2, 1, 6, 8, 9, 3, 4, 5]) {
  for (let mode = 0; mode < 2 && Date.now() < stop; mode++) {
    const start = performance.now()
    const target = baseline.containers.filter((_,index) => index !== removedIndex).map(c => ({ ...c, items: [...c.items] }))
    const removed = baseline.containers[removedIndex].items.map(p => p.item)
    const unpacked: CargoItem[] = []
    const until = Math.min(stop, Date.now() + 45000)
    for (const item of orderItems(removed, mode)) {
      let placed = false
      // Prefer emptier bins while moving the most constrained pieces.
      const orderedContainers = [...target].sort((a,b) => mode ? a.volumeUtilization - b.volumeUtilization : b.volumeUtilization - a.volumeUtilization)
      for (const container of orderedContainers) {
        if (Date.now() >= until) break
        const p = extraPlacement(item, container, until)
        if (p) { container.items.push(p); updateContainer(container); placed = true; break }
      }
      if (!placed) unpacked.push(item)
    }
    const solution = createPackingSolution(target, unpacked, 'RESEARCH-DESTROY-REPAIR', calculateSolutionScore(target, unpacked, target[0].dimensions), performance.now()-start)
    solution.searchMode = 'heuristic'; solution.terminationReason = Date.now() >= until ? 'time-limit' : 'completed'
    solution.notes = ['研究方案：不作为交付结果；12032×2352×2698mm物理空间，与原PDF净装载空间不同。']
    solution.validation = validateSolution(solution, inputs)
    const info = { removedIndex, mode, containers: solution.totalContainers, unpacked: unpacked.length, valid: solution.validation.valid, ms: Math.round(performance.now()-start), leftover: unpacked.map(i=>i.name) }
    console.log(JSON.stringify(info)); trials.push(info)
    if (solution.validation.valid && unpacked.length < bestUnpacked) {
      bestUnpacked = unpacked.length
      writeFileSync('delivery-output/research/geometry-repair-best.json', JSON.stringify(solution,null,2))
      if (!unpacked.length) { writeFileSync('delivery-output/research/geometry-repair-complete.json', JSON.stringify(solution,null,2)); break }
    }
  }
  if (!bestUnpacked || Date.now() >= stop) break
}
writeFileSync('delivery-output/research/geometry-trials.json', JSON.stringify(trials,null,2))
