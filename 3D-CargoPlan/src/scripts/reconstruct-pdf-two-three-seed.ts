// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import type { CargoItem, Orientation, PlacedItem, Position3D } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance } from '../core/research-calibration'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, tryPlaceItem, updateContainer } from '../core/packing-utils'
import { pairGeometryErrors } from '../core/solid-geometry'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { createPackingSolution } from '../core/solution-builder'
import { validateSolution } from '../core/validation'

const calibration = loadResearchCalibration('data/reconstruction/model-v2-contract.json')
const requested = Number(process.argv[2] ?? 2)
if (![2, 3].includes(requested)) throw new Error('Choose fixed PDF container 2 or 3')
const allocation = calibration.pdfAllocation.find(c => c.containerNumber === requested)!
const sourceItems = calibration.items.filter(i => allocation.ids.includes(i.id))
const c = createEmptyContainer(0, calibration.config, sourceItems)
const used = new Set<string>(), attempts: unknown[] = [], start = Date.now()
const take = (sheet: string, row: number) => sourceItems.filter(i => !used.has(i.id) && i.rawData._sourceSheet === sheet && i.rawData._sourceRow === row)
function put(item: CargoItem | undefined, position: Position3D, orientation: Orientation, rotation = 0, required = true) {
  if (!item) throw new Error('Insufficient source units for requested seed')
  const candidate: PlacedItem = { item, position, orientation, rotation, actualDimensions: calculateActualDimensions(item.dimensions, orientation, rotation, item.orientationVerticalAxes) }
  const accepted = canPlaceAt(item, position, orientation, rotation, c)
  attempts.push({ id: item.id, position, orientation, rotation, accepted, ...(!accepted ? { errors: [...c.items.flatMap(other => pairGeometryErrors(candidate, other, c)), ...analyzeStacking([...c.items, candidate], c.loadingRules).errors] } : {}) })
  if (!accepted) {
    if (required) throw new Error(JSON.stringify(attempts.at(-1)))
    return false
  }
  c.items.push(candidate); used.add(item.id); updateContainer(c)
  return true
}
function pile(sheet: string, row: number, count: number, x: number, y: number, z: number, orientation: Orientation, rotation = 0) {
  const units = take(sheet, row).slice(0, count)
  if (units.length !== count) throw new Error(`Wrong source count ${sheet}/${row}`)
  const h = calculateActualDimensions(units[0].dimensions, orientation, rotation, units[0].orientationVerticalAxes).height
  for (let i = 0; i < units.length; i++) put(units[i], { x, y, z: z + i * (h + 5) }, orientation, rotation)
}
const output = `data/reconstruction/pdf-container-${requested === 2 ? 'two' : 'three'}-seed`
mkdirSync(output, { recursive: true })
let constructionError: string | null = null
try {
  // Five two-high lying columns support a two-frame flat bridge; a separate
  // ten-frame flat pile occupies the next lane. This preserves all source
  // stack counts and distributes bridge loads over five independent columns.
  // Coordinates construct a fixed-allocation replay, not an exact raster trace.
  for (let lane = 0; lane < 5; lane++) pile('门窗', 23, 2, 0, lane * 215, 0, 'lying')
  pile('门窗', 23, 2, 0, 0, 1990, 'flat')
  pile('门窗', 23, 10, 0, 1075, 0, 'flat')
  const sashCount = take('门窗', 22).length
  for (let lane = 0; lane < sashCount / 2; lane++) pile('门窗', 22, 2, lane * 1595, 2070, 0, 'lying')
  const frameCount = take('门窗', 16).length
  for (let i = 0; i < frameCount; i++) put(take('门窗', 16)[0], { x: 6605, y: i * 165, z: 0 }, 'lying')
  const rack = sourceItems.find(i => i.rawData._sourceSheet === '玻璃架')!
  const rackX = 11600 - rack.dimensions.width
  put(rack, { x: rackX, y: 0, z: 0 }, 'standing', 90)
  const rackZ = rack.dimensions.height + 5
  if (requested === 2) {
    pile('门窗', 12, 8, 6605, 1650, 0, 'flat')
    pile('门窗', 12, 8, 6605, 1875, 0, 'flat')
    put(take('门窗', 9)[0], { x: 6605, y: 2100, z: 0 }, 'lying')
    put(take('门窗', 21)[0], { x: 9640, y: 2100, z: 0 }, 'standing')
    for (let i = 0; i < 5; i++) put(take('门窗', 17)[0], { x: 9640 + i * 115, y: 0, z: 0 }, 'standing', 90)
  } else {
    for (let i = 0; i < 4; i++) put(take('门窗', 9)[0], { x: 6605, y: 1485 + i * 125, z: 0 }, 'lying')
    pile('门窗', 18, 9, 6605, 1985, 0, 'lying')
    // Two narrow full-width beam piles fit in the gap before the rack.
    pile('门窗', 24, 11, 9640, 0, 0, 'flat', 90)
    pile('门窗', 24, 11, 9895, 0, 0, 'flat', 90)
  }
  // Small windows stand on the glass rack; all retain the source constraints.
  for (let i = 0; i < 4; i++) put(take('门窗', 5)[0], { x: rackX + i * 125, y: 0, z: rackZ }, 'standing', 90)
  let index = 0
  for (const row of [6, 7]) while (take('门窗', row).length) {
    const p = requested === 3
      ? index < 5 ? { x: rackX + 500 + index * 125, y: 0, z: rackZ } : { x: 10570, y: 1535 + (index - 5) * 125, z: rackZ }
      : { x: rackX + 500 + Math.floor(index / 2) * 125, y: (index % 2) * 1035, z: rackZ }
    put(take('门窗', row)[0], p, 'standing', requested === 3 && index >= 5 ? 0 : 90)
    index++
  }
  if (requested === 3) {
    // Use lower lying-frame cavities for the long narrow trim. Upper cavities
    // carry only a small remaining load so the lower frame stays below 120kg.
    for (let host = 0; host < 4; host++) for (let lane = 0; lane < 2; lane++) {
      const count = Math.min(6, take('门窗', 19).length)
      if (count) pile('门窗', 19, count, 1805, host * 215 + lane * 85, 105, 'lying')
    }
    for (let lane = 0; lane < 2; lane++) pile('门窗', 13, 6, 1805, 860 + lane * 85, 105, 'lying')
    pile('门窗', 13, 1, 1805, 0, 1100, 'lying')
    pile('门窗', 13, 2, 1805, 215, 1100, 'lying')
    pile('辅材', 5, 3, rackX + 500, 1035, rackZ, 'standing')
  }
  // Fill only this original allocation; no cross-container reassignment.
  const remaining = sourceItems.filter(i => !used.has(i.id)).sort((a, b) => b.dimensions.length * b.dimensions.width * b.dimensions.height - a.dimensions.length * a.dimensions.width * a.dimensions.height)
  const deadline = Date.now() + 25000
  let progress = true
  while (progress && Date.now() < deadline) {
    progress = false
    for (const item of remaining) {
      if (used.has(item.id)) continue
      const placed = tryPlaceItem(item, c, deadline)
      if (placed) { put(item, placed.position, placed.orientation, placed.rotation); progress = true }
    }
  }
} catch (error) { constructionError = error instanceof Error ? error.message : String(error) }
const unpacked = sourceItems.filter(i => !used.has(i.id))
const solution = createPackingSolution([c], unpacked, `PDF-P${requested * 2 - 1}-FIXED-ALLOCATION-RECONSTRUCTION`, 0, Date.now() - start)
solution.validation = validateSolution(solution, sourceItems, calibration.config)
const engineFiles = ['src/core/packing-utils.ts', 'src/core/solid-geometry.ts', 'src/core/validation.ts', 'src/core/loading-profile.ts', 'src/core/greedy-algorithm.ts', 'src/core/solution-builder.ts', 'src/core/research-calibration.ts', 'src/types/packing.ts', 'src/scripts/reconstruct-pdf-two-three-seed.ts'].map(path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }))
const stack = analyzeStacking(c.items, c.loadingRules)
const lyingLongFrameLoads = c.items.flatMap((p, i) => p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === 23 && p.orientation === 'lying' ? [{ id: p.item.id, position: p.position, topLoadKg: stack.topLoads[i], carriedLoadKg: stack.carriedLoads[i], topDescendantCount: stack.descendants[i].size, strictTopLoadLimitKg: 120 }] : [])
const result = { sourceContainerNumber: requested, sourceIds: allocation.ids, complete: unpacked.length === 0 && solution.validation.valid, config: calibration.config, solution, validation: solution.validation, provenance: researchCalibrationProvenance(calibration), engineFiles, constructionVersion: 'fixed-allocation-five-column-bridge-v1', construction: 'Original PDF fixed allocation. Five two-high lying frame columns plus a two-flat-frame bridge and one ten-flat-frame pile; explicit coordinates, source rules and safe local insertion. No claim to recover hidden original XYZ. Incomplete outputs are evidence only.', constructionError, lyingLongFrameLoads, maximumLyingLongFrameTopLoadKg: Math.max(...lyingLongFrameLoads.map(p => p.topLoadKg)), attempts }
writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify({ output, loaded: c.items.length, expected: sourceItems.length, complete: result.complete, valid: result.validation.valid, unpacked: unpacked.map(i => `${i.id}: ${i.name}`), constructionError, errors: result.validation.errors.slice(0, 5) }))
