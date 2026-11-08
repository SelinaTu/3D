// #created 11/08/2026
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { CargoItem, Orientation, PlacedItem, Position3D } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance } from '../core/research-calibration'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, tryPlaceItem, updateContainer } from '../core/packing-utils'
import { pairGeometryErrors } from '../core/solid-geometry'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { createPackingSolution } from '../core/solution-builder'
import { validateSolution } from '../core/validation'

const cal = loadResearchCalibration('data/reconstruction/model-v2-contract.json')
const allocation = cal.pdfAllocation.find(c => c.containerNumber === 6)!
const items = cal.items.filter(i => allocation.ids.includes(i.id)), start = Date.now()
const c = createEmptyContainer(0, cal.config, items), used = new Set<string>()
const attempts: { id: string; phase: string; position: Position3D; orientation: Orientation; rotation: number; accepted: boolean; errors: string[] }[] = []
let phase = 'rack-and-roof-macro'
const take = (sheet: string, row: number) => items.filter(i => !used.has(i.id) && i.rawData._sourceSheet === sheet && i.rawData._sourceRow === row)
function put(item: CargoItem | undefined, position: Position3D, orientation: Orientation, rotation = 0) {
  if (!item) return false
  const candidate: PlacedItem = { item, position, orientation, rotation, actualDimensions: calculateActualDimensions(item.dimensions, orientation, rotation, item.orientationVerticalAxes) }
  const accepted = canPlaceAt(item, position, orientation, rotation, c)
  const errors = accepted ? [] : [...c.items.flatMap(other => pairGeometryErrors(candidate, other, c)), ...analyzeStacking([...c.items, candidate], c.loadingRules).errors]
  attempts.push({ id: item.id, phase, position, orientation, rotation, accepted, errors })
  if (accepted) { c.items.push(candidate); used.add(item.id); updateContainer(c) }
  return accepted
}
function pile(sheet: string, row: number, count: number, x: number, y: number, z: number, orientation: Orientation, rotation = 0) {
  const units = take(sheet, row).slice(0, count)
  for (let i = 0; i < units.length; i++) {
    const h = calculateActualDimensions(units[i].dimensions, orientation, rotation, units[i].orientationVerticalAxes).height
    put(units[i], { x, y, z: z + i * (h + 5) }, orientation, rotation)
  }
}
for (const [row, x] of [[12, 0], [29, 2673], [30, 5907], [31, 8580]]) put(take('玻璃架', row)[0], { x, y: 0, z: 0 }, 'standing')
pile('门窗', 5, 4, 0, 0, 1209, 'flat')
pile('门窗', 6, 6, 1335, 0, 1209, 'flat', 90)
put(take('门窗', 7)[0], { x: 2370, y: 0, z: 1209 }, 'lying', 90)
put(take('门窗', 7)[0], { x: 2495, y: 0, z: 1209 }, 'lying', 90)
pile('门窗', 17, 5, 2678, 0, 1089, 'flat')
pile('门窗', 25, 6, 4995, 0, 1098, 'lying')
for (const [y, count] of [[115, 6], [420, 6], [725, 2]]) pile('门窗', 10, count, 5907, y, 1098, 'lying')
pile('门窗', 21, 2, 9150, 115, 1098, 'flat')
put(take('门窗', 7)[0], { x: 5907, y: 1030, z: 1098 }, 'lying')
put(take('门窗', 7)[0], { x: 5907, y: 1155, z: 1098 }, 'lying')
pile('门窗', 24, 5, 5907, 1280, 1098, 'lying')
put(take('辅材', 32)[0], { x: 8142, y: 1030, z: 1098 }, 'lying')
pile('辅材', 40, 5, 8577, 1030, 1098, 'standing')
const roofSnapshot = { acceptedUnits: used.size, rejectedAttempts: attempts.filter(a => !a.accepted), residualIds: items.filter(i => !used.has(i.id)).map(i => i.id) }
// One bounded original-container insertion pass. Existing canPlaceAt keeps all
// source conditions; no cross-container moves and no 80% support relaxation.
phase = 'single-bounded-local-fill'
const fillStart = Date.now(), deadline = fillStart + 30000
const remaining = items.filter(i => !used.has(i.id)).sort((a, b) => {
  const aTall = a.allowedOrientations.length === 1 ? 1 : 0, bTall = b.allowedOrientations.length === 1 ? 1 : 0
  return bTall - aTall || b.dimensions.length * b.dimensions.width * b.dimensions.height - a.dimensions.length * a.dimensions.width * a.dimensions.height
})
for (const item of remaining) {
  if (Date.now() >= deadline) break
  const p = tryPlaceItem(item, c, deadline)
  if (p) put(item, p.position, p.orientation, p.rotation)
}
const unpacked = items.filter(i => !used.has(i.id))
const solution = createPackingSolution([c], unpacked, 'PDF-P11-FIXED-ALLOCATION-ROOF-MACRO', 0, Date.now() - start)
solution.validation = validateSolution(solution, items, cal.config)
const engineFiles = ['src/core/packing-utils.ts', 'src/core/solid-geometry.ts', 'src/core/validation.ts', 'src/core/loading-profile.ts', 'src/core/greedy-algorithm.ts', 'src/scripts/reconstruct-pdf-six-seed.ts'].map(path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }))
const missingGroups = Object.values(unpacked.reduce<Record<string, { sourceRef: string; name: string; quantity: number; ids: string[] }>>((out, i) => {
  const key = `${i.rawData._sourceSheet}:${i.rawData._sourceRow}`
  const row = out[key] ??= { sourceRef: key, name: i.name, quantity: 0, ids: [] }
  row.quantity++; row.ids.push(i.id); return out
}, {}))
const result = { sourceContainerNumber: 6, sourceIds: allocation.ids, complete: unpacked.length === 0 && solution.validation.valid, config: cal.config, solution, validation: solution.validation, provenance: researchCalibrationProvenance(cal), engineFiles, construction: 'Original PDF container 6 fixed IDs; supplied rack/roof macro checked one item at a time, then at most one 30-second safe local insertion pass. No exact-raster-pose claim and no source-rule relaxation.', roofSnapshot, fillElapsedMs: Date.now() - fillStart, timedOut: Date.now() >= deadline, missingGroups, attempts }
const output = 'data/reconstruction/pdf-container-six-seed'
mkdirSync(output, { recursive: true })
writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify({ output, expected: items.length, loaded: used.size, complete: result.complete, validPlacedSubset: solution.validation.valid, elapsedMs: Date.now() - start, roofAccepted: roofSnapshot.acceptedUnits, rejectedRoof: roofSnapshot.rejectedAttempts.map(a => ({ id: a.id, errors: a.errors })), missingGroups: missingGroups.map(g => ({ sourceRef: g.sourceRef, quantity: g.quantity })) }))
