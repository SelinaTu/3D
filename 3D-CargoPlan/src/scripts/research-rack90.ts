// #created 11/08/2026
/** Independent rack-yaw/column research: proxies are always expanded and audited. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import type { CargoItem, Container, PlacedItem } from '../types/packing'
import { loadResearchCalibration, assertResearchCalibration, researchCalibrationProvenance, compareResearchWithPdf, researchReallocation } from '../core/research-calibration'
import { assessResearchCandidate, canonicalResearchSolution, compareResearchMetrics } from '../core/research-metrics'
import { calculateActualDimensions, orientationsFor, findPlacementPoints, canPlaceAt, updateContainer, volume } from '../core/packing-utils'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { createPackingSolution } from '../core/solution-builder'
import { isGlassRack } from '../core/solid-geometry'

const calibration = loadResearchCalibration('data/calibration/packing-contract.json'), config = calibration.config
const output = 'delivery-output/research/pdf-projection-rack90'; mkdirSync(output, { recursive: true })
const start = Date.now(), deadline = start + 300000, gap = calibration.support.gapMm
const sourceKey = (i: CargoItem) => `${i.rawData._sourceSheet}/${i.rawData._sourceRow}`
const sourceGroups = new Map<string, CargoItem[]>()
for (const item of calibration.items) sourceGroups.set(sourceKey(item), [...(sourceGroups.get(sourceKey(item)) ?? []), item])
const prior = JSON.parse(readFileSync('delivery-output/research/pdf-projection-order/best-current-order-research.json', 'utf8'))
const priorities = new Map<string, number>((prior.trial.groupOrder as string[]).map((id, i) => [id, i]))
const rackNumbers = [6, 10, 14, 15, 17, 19, 29, 30]
const rackNumber = (i: CargoItem) => isGlassRack(i) ? Number(i.name.match(/^(\d+)#/)?.[1]) : NaN
const variants = [
  { seed: 'original', columns: 'height', rackFirst: false, yaw90: true },
  { seed: 'height-up', columns: 'height', rackFirst: false, yaw90: true },
  { seed: 'height-down', columns: 'height', rackFirst: false, yaw90: true },
  { seed: 'none', columns: 'height', rackFirst: false, yaw90: true },
  { seed: 'none', columns: 'height', rackFirst: true, yaw90: true },
  { seed: 'original', columns: 'long-flat', rackFirst: false, yaw90: true },
  { seed: 'height-up', columns: 'long-flat', rackFirst: false, yaw90: true },
  { seed: 'height-down', columns: 'area', rackFirst: false, yaw90: true },
  { seed: 'none', columns: 'area', rackFirst: true, yaw90: true },
  { seed: 'original', columns: 'area', rackFirst: true, yaw90: false },
] as const
let best: ReturnType<typeof assessResearchCandidate> | undefined
const records: unknown[] = []
for (let trial = 0; trial < variants.length && Date.now() < deadline; trial++) {
  assertResearchCalibration(calibration, calibration.items, config)
  const policy = variants[trial], trialStart = Date.now(), until = Math.min(deadline, trialStart + 45000)
  const columns: CargoItem[] = [], metadata = new Map<string, { units: CargoItem[]; orientation: PlacedItem['orientation']; rotation: number; unitHeight: number }>()
  for (const units of sourceGroups.values()) {
    const source = units[0]
    const options = orientationsFor(source).filter(v => v.dimensions.length <= config.containerDimensions.length && v.dimensions.width <= config.containerDimensions.width && v.dimensions.height <= (source.rawData._sourceSheet === '门窗' && source.rawData._sourceRow === 16 ? 2560 : config.containerDimensions.height)).map(v => {
      const limits = { maxStackCount: source.maxStackCount, maxStackWeight: source.maxStackWeight, ...source.constraints?.orientationRules?.[v.orientation] }
      let count = Math.min(units.length, Math.floor((config.containerDimensions.height + gap) / (v.dimensions.height + gap)))
      if (!source.canStackOnTop || source.constraints?.mustBeOnFloor || isGlassRack(source) || source.stackableWith?.includes('@not-self')) count = 1
      if (limits.maxSupportedItemWeight !== undefined && source.weight > limits.maxSupportedItemWeight) count = 1
      const d = source.dimensions
      if (source.constraints?.supportedItemsLargestFaceDown && v.dimensions.length * v.dimensions.width < Math.max(d.length * d.width, d.length * d.height, d.width * d.height) - 1e-6) count = 1
      if (limits.maxStackCount !== undefined) count = Math.min(count, limits.maxStackCount + 1)
      if (limits.maxStackWeight !== undefined) while (count > 1 && (limits.strictMaxStackWeight ? (count - 1) * source.weight >= limits.maxStackWeight : (count - 1) * source.weight > limits.maxStackWeight)) count--
      count = Math.max(1, count)
      const area = Math.ceil(units.length / count) * v.dimensions.length * v.dimensions.width
      const score = policy.columns === 'height' ? area / Math.min(config.containerDimensions.height, v.dimensions.height * count + (count - 1) * gap) * config.containerDimensions.height : policy.columns === 'long-flat' && d.length > config.containerDimensions.length / 2 ? area * (v.orientation === 'flat' ? 0.5 : 1) : area
      return { ...v, count, score }
    }).sort((a, b) => a.score - b.score || b.count - a.count)
    const selected = options[0]
    if (!selected) throw new Error(`无允许的宏列方向: ${source.id}`)
    for (let i = 0; i < units.length; i += selected.count) {
      const batch = units.slice(i, i + selected.count), id = batch[0].id
      metadata.set(id, { units: batch, orientation: selected.orientation, rotation: selected.rotation, unitHeight: selected.dimensions.height })
      columns.push({ ...source, id, quantity: 1, cavity: undefined, orientationVerticalAxes: undefined, constraints: source.constraints?.mustBeOnFloor ? { mustBeOnFloor: true } : undefined, dimensions: { length: selected.dimensions.length, width: selected.dimensions.width, height: selected.dimensions.height * batch.length + gap * (batch.length - 1) }, weight: batch.reduce((s, i) => s + i.weight, 0), allowedOrientations: ['standing'], forbiddenOrientations: [], canStackOnTop: isGlassRack(source), maxStackCount: undefined, maxStackWeight: isGlassRack(source) ? source.maxStackWeight : undefined })
    }
  }
  columns.sort((a, b) => (policy.rackFirst ? Number(isGlassRack(b)) - Number(isGlassRack(a)) : 0) || (priorities.get(sourceKey(a)) ?? Infinity) - (priorities.get(sourceKey(b)) ?? Infinity) || volume(b.dimensions) - volume(a.dimensions))
  const containers: Container[] = [], unpacked: CargoItem[] = [], seeded = new Set<string>()
  if (policy.seed !== 'none') {
    let racks = rackNumbers.map(number => columns.find(c => rackNumber(c) === number)!)
    if (racks.some(i => !i)) throw new Error('八架源清单不完整')
    if (policy.seed === 'height-up') racks = racks.sort((a, b) => a.dimensions.height - b.dimensions.height)
    if (policy.seed === 'height-down') racks = racks.sort((a, b) => b.dimensions.height - a.dimensions.height)
    const first = createEmptyContainer(0, config, calibration.items); let x = 0
    for (const rack of racks) {
      const position = { x, y: 0, z: 0 }
      if (!canPlaceAt(rack, position, 'standing', 90, first)) throw new Error(`八架真实约束校验失败: ${rack.id}`)
      const actualDimensions = calculateActualDimensions(rack.dimensions, 'standing', 90)
      first.items.push({ item: rack, position, orientation: 'standing', rotation: 90, actualDimensions }); updateContainer(first); x += actualDimensions.length; seeded.add(rack.id)
    }
    containers.push(first)
  }
  const place = (item: CargoItem, container: Container): PlacedItem | null => {
    const rotations = policy.yaw90 && isGlassRack(item) ? [90, 0] : [0, 90]
    for (const position of findPlacementPoints(container)) for (const rotation of rotations) {
      if (Date.now() >= until) return null
      if (canPlaceAt(item, position, 'standing', rotation, container)) return { item, position: { ...position }, orientation: 'standing', rotation, actualDimensions: calculateActualDimensions(item.dimensions, 'standing', rotation) }
    }
    return null
  }
  for (const column of columns) {
    if (seeded.has(column.id)) continue
    if (Date.now() >= until) { unpacked.push(...metadata.get(column.id)!.units); continue }
    let loaded = false
    for (const container of containers) { const p = place(column, container); if (p) { container.items.push(p); updateContainer(container); loaded = true; break } }
    if (!loaded) { const empty = createEmptyContainer(containers.length, config, calibration.items), p = place(column, empty); if (p) { empty.items.push(p); updateContainer(empty); containers.push(empty) } else unpacked.push(...metadata.get(column.id)!.units) }
  }
  for (const container of containers) {
    container.items = container.items.flatMap(p => { const meta = metadata.get(p.item.id)!, rotation = (p.rotation + meta.rotation) % 360; return meta.units.map((item, i) => ({ item, position: { x: p.position.x, y: p.position.y, z: p.position.z + i * (meta.unitHeight + gap) }, orientation: meta.orientation, rotation, actualDimensions: calculateActualDimensions(item.dimensions, meta.orientation, rotation, item.orientationVerticalAxes) })) }); updateContainer(container)
  }
  const solution = createPackingSolution(containers, unpacked, 'RACK90-COLUMN-RESEARCH', 0, Date.now() - trialStart)
  if (unpacked.length) { const record = { trial, policy, elapsedMs: Date.now() - start, containers: containers.length, unpacked: unpacked.length, validation: 'not-assessed-incomplete' }; records.push(record); console.log(JSON.stringify(record)); continue }
  const assessed = assessResearchCandidate(solution, calibration.items, config)
  const improved = assessed.metrics.eligible && (!best || compareResearchMetrics(assessed.metrics, best.metrics) < 0)
  const record = { trial, policy, elapsedMs: Date.now() - start, candidateMs: Date.now() - trialStart, containers: assessed.metrics.totalContainers, unpacked: solution.unpackedItems.length, valid: assessed.validation.valid, errors: assessed.validation.errors.slice(0, 4), tailSolidM3: assessed.metrics.tailSolidVolumeMm3 / 1e9, improved }
  records.push(record); console.log(JSON.stringify(record))
  if (improved) { best = assessed; writeFileSync(`${output}/best-complete.json`, JSON.stringify({ provenance: researchCalibrationProvenance(calibration), config, policy, metrics: assessed.metrics, pdfComparison: compareResearchWithPdf(assessed.metrics, calibration), reallocation: researchReallocation(canonicalResearchSolution(assessed), calibration), solution: canonicalResearchSolution(assessed) }, null, 2)) }
  writeFileSync(`${output}/trials.json`, JSON.stringify(records, null, 2))
}
