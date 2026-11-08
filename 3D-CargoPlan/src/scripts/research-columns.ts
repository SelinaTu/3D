// #created 11/08/2026
/** Conservative stack-column construction; every expanded physical unit is audited. */
import { mkdirSync, writeFileSync } from 'node:fs'
import type { CargoItem, Container, PlacedItem } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, compareResearchWithPdf } from '../core/research-calibration'
import { assessResearchCandidate, canonicalResearchSolution, compareResearchMetrics } from '../core/research-metrics'
import { orientationsFor, tryPlaceItem, updateContainer, volume, calculateActualDimensions, findPlacementPoints, canPlaceAt } from '../core/packing-utils'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { createPackingSolution } from '../core/solution-builder'
import { isGlassRack } from '../core/solid-geometry'

const calibration = loadResearchCalibration('data/calibration/packing-contract.json')
const output = 'delivery-output/research/pdf-projection-columns'
mkdirSync(output, { recursive: true })
const start = Date.now(), deadline = start + 300000
const groups = new Map<string, CargoItem[]>()
for (const item of calibration.items) {
  const key = `${item.rawData._sourceSheet}/${item.rawData._sourceRow}`
  groups.set(key, [...(groups.get(key) ?? []), item])
}
let best: ReturnType<typeof assessResearchCandidate> | undefined
const trials: unknown[] = []
let state = 671339
const random = () => { state = Math.imul(1664525, state) + 1013904223 >>> 0; return state / 4294967296 }
for (let trial = 0; trial < 130; trial++) {
  const preference = (['area', 'height', 'long-flat'] as const)[trial < 9 ? Math.floor(trial / 3) : 1]
  const orderMode = (['rigidity', 'area', 'rack-first'] as const)[trial % 3]
  if (Date.now() >= deadline) break
  const metadata = new Map<string, { units: CargoItem[]; orientation: PlacedItem['orientation']; rotation: number; height: number }>()
  const columns: CargoItem[] = []
  for (const units of groups.values()) {
    const source = units[0]
    const rackTopGroup = trial >= 100 && source.rawData._sourceSheet === '门窗' && [5, 6, 7, 8, 22].includes(Number(source.rawData._sourceRow))
    const stackCeiling = rackTopGroup ? [650, 850, 1050][trial % 3] : 2500
    const variants = orientationsFor(source).filter(v => v.dimensions.length <= 11600 && v.dimensions.width <= 2250 && v.dimensions.height <= (source.rawData._sourceSheet === '门窗' && source.rawData._sourceRow === 16 ? 2560 : 2500))
    const options = variants.map(v => {
      const rule = { maxStackCount: source.maxStackCount, maxStackWeight: source.maxStackWeight, ...source.constraints?.orientationRules?.[v.orientation] }
      let count = Math.min(units.length, Math.floor((stackCeiling + 5) / (v.dimensions.height + 5)))
      if (!source.canStackOnTop || source.constraints?.mustBeOnFloor || isGlassRack(source)) count = 1
      if (source.stackableWith?.includes('@not-self')) count = 1
      if (rule.maxSupportedItemWeight !== undefined && source.weight > rule.maxSupportedItemWeight) count = 1
      const original = source.dimensions
      if (source.constraints?.supportedItemsLargestFaceDown && v.dimensions.length * v.dimensions.width < Math.max(original.length * original.width, original.length * original.height, original.width * original.height) - 1e-6) count = 1
      if (rule.maxStackCount !== undefined) count = Math.min(count, rule.maxStackCount + 1)
      if (rule.maxStackWeight !== undefined && source.weight > 0) {
        while (count > 1 && (rule.strictMaxStackWeight ? (count - 1) * source.weight >= rule.maxStackWeight : (count - 1) * source.weight > rule.maxStackWeight)) count--
      }
      count = Math.max(1, count)
      const area = Math.ceil(units.length / count) * v.dimensions.length * v.dimensions.width
      const score = preference === 'height' ? area / Math.min(2500, v.dimensions.height * count + (count - 1) * 5) * 2500 : preference === 'long-flat' && source.dimensions.length > 5800 ? area * (v.orientation === 'flat' ? 0.5 : 1) : area
      return { ...v, count, score: score * (rackTopGroup && v.orientation !== 'flat' ? 20 : 1) * (trial < 9 ? 1 : 0.8 + random() * 0.4) }
    }).sort((a, b) => a.score - b.score || b.count - a.count)
    const selected = options[0]
    if (!selected) throw new Error(`No legal column orientation: ${source.id}`)
    for (let i = 0; i < units.length; i += selected.count) {
      const batch = units.slice(i, i + selected.count), id = batch[0].id
      metadata.set(id, { units: batch, orientation: selected.orientation, rotation: selected.rotation, height: selected.dimensions.height })
      columns.push({ ...source, id, quantity: 1, cavity: undefined, constraints: source.constraints?.mustBeOnFloor ? { mustBeOnFloor: true } : undefined, orientationVerticalAxes: undefined,
        dimensions: { length: selected.dimensions.length, width: selected.dimensions.width, height: selected.dimensions.height * batch.length + 5 * (batch.length - 1) },
        weight: batch.reduce((n, item) => n + item.weight, 0), allowedOrientations: ['standing'], forbiddenOrientations: [],
        canStackOnTop: isGlassRack(source), maxStackCount: undefined, maxStackWeight: isGlassRack(source) ? source.maxStackWeight : undefined,
      })
    }
  }
  const flexibilityWeight = random() * 2 - 1, footprintWeight = random(), rackWeight = random() * 6 - 3
  const scores = new Map(columns.map(c => [c.id, Math.log(volume(c.dimensions)) + Math.log(c.dimensions.length * c.dimensions.width) * footprintWeight + metadata.get(c.id)!.units[0].allowedOrientations.length * flexibilityWeight + Number(isGlassRack(c)) * rackWeight + random() * 0.7]))
  columns.sort((a, b) => {
    if (trial >= 100 && isGlassRack(a) !== isGlassRack(b)) return Number(isGlassRack(b)) - Number(isGlassRack(a))
    if (trial >= 9) return scores.get(b.id)! - scores.get(a.id)!
    const rigidity = (i: CargoItem) => metadata.get(i.id)!.units[0].allowedOrientations.length
    if (orderMode === 'rack-first' && isGlassRack(a) !== isGlassRack(b)) return Number(isGlassRack(b)) - Number(isGlassRack(a))
    return (orderMode === 'rigidity' ? rigidity(a) - rigidity(b) : 0) || (orderMode === 'area' ? b.dimensions.length * b.dimensions.width - a.dimensions.length * a.dimensions.width : volume(b.dimensions) - volume(a.dimensions))
  })
  const containers: Container[] = [], unpacked: CargoItem[] = []
  const until = Math.min(deadline, Date.now() + 45000)
  const place = (column: CargoItem, container: Container) => {
    if (trial >= 9 && trial % 2 === 0 && isGlassRack(column)) {
      for (const p of findPlacementPoints(container)) for (const rotation of [90, 0]) {
        if (canPlaceAt(column, p, 'standing', rotation, container)) return { item: column, position: { ...p }, orientation: 'standing' as const, rotation, actualDimensions: calculateActualDimensions(column.dimensions, 'standing', rotation) }
      }
      return null
    }
    return tryPlaceItem(column, container, until)
  }
  for (const column of columns) {
    if (Date.now() >= until) { unpacked.push(...metadata.get(column.id)!.units); continue }
    let selected = containers.find(c => {
      const p = place(column, c)
      if (!p) return false
      c.items.push(p); updateContainer(c); return true
    })
    if (!selected) {
      const empty = createEmptyContainer(containers.length, calibration.config, calibration.items)
      const p = place(column, empty)
      if (p) { empty.items.push(p); updateContainer(empty); containers.push(empty); selected = empty }
      else unpacked.push(...metadata.get(column.id)!.units)
    }
  }
  for (const container of containers) {
    container.items = container.items.flatMap(p => {
      const meta = metadata.get(p.item.id)!, rotation = (meta.rotation + p.rotation) % 360
      return meta.units.map((item, i) => ({ item, orientation: meta.orientation, rotation, position: { x: p.position.x, y: p.position.y, z: p.position.z + i * (meta.height + 5) }, actualDimensions: calculateActualDimensions(item.dimensions, meta.orientation, rotation, item.orientationVerticalAxes) }))
    }); updateContainer(container)
  }
  const solution = createPackingSolution(containers, unpacked, `COLUMN-${preference}-${orderMode}`, 0, Date.now() - start)
  solution.searchMode = 'heuristic'; solution.terminationReason = unpacked.length ? 'time-limit' : 'completed'
  const assessed = assessResearchCandidate(solution, calibration.items, calibration.config)
  const record = { trial, preference, orderMode, columns: columns.length, containers: solution.totalContainers, unpacked: unpacked.length, valid: assessed.validation.valid, errors: assessed.validation.errors.slice(0, 3), elapsedMs: Date.now() - start }
  trials.push(record); console.log(JSON.stringify(record))
  if (assessed.metrics.eligible && (!best || compareResearchMetrics(assessed.metrics, best.metrics) < 0)) {
    best = assessed
    writeFileSync(`${output}/best.json`, JSON.stringify({ provenance: researchCalibrationProvenance(calibration), metrics: assessed.metrics, pdfComparison: compareResearchWithPdf(assessed.metrics, calibration), solution: canonicalResearchSolution(assessed) }, null, 2))
  }
  writeFileSync(`${output}/trials.json`, JSON.stringify(trials, null, 2))
}
