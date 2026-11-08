// #created 11/08/2026
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { readPreviousReplayResult, startReplayRecord } from './replay-run-record'
import type { CargoItem, Orientation, Position3D } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance } from '../core/research-calibration'
import { canPlaceAt, calculateActualDimensions, updateContainer, analyzeStacking } from '../core/packing-utils'
import { pairGeometryErrors } from '../core/solid-geometry'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { createPackingSolution } from '../core/solution-builder'
import { validateSolution } from '../core/validation'

const finishRecord = startReplayRecord(import.meta.url)
const calibration = loadResearchCalibration('data/reconstruction/model-v2-contract.json')
const allocation = calibration.pdfAllocation.find(c => c.containerNumber === 11)!
const items = calibration.items.filter(i => allocation.ids.includes(i.id))
const c = createEmptyContainer(10, calibration.config, items)
const used = new Set<string>(), attempts: unknown[] = [], start = Date.now()
const take = (sheet: string, row: number) => items.filter(i => !used.has(i.id) && i.rawData._sourceSheet === sheet && i.rawData._sourceRow === row)
function put(item: CargoItem, p: Position3D, orientation: Orientation, rotation = 0) {
  const d = calculateActualDimensions(item.dimensions, orientation, rotation, item.orientationVerticalAxes)
  const placed = { item, position: p, orientation, rotation, actualDimensions: d }
  const accepted = canPlaceAt(item, p, orientation, rotation, c)
  attempts.push({ id: item.id, position: p, orientation, rotation, accepted, diagnostic: accepted ? [] : [...c.items.flatMap(other => pairGeometryErrors(placed, other, c)), ...analyzeStacking([...c.items, placed], c.loadingRules).errors] })
  if (!accepted) throw new Error(JSON.stringify(attempts.at(-1)))
  c.items.push(placed); used.add(item.id); updateContainer(c)
}
function pile(sheet: string, row: number, count: number, x: number, y: number, z: number, orientation: Orientation, rotation = 0) {
  const units = take(sheet, row).slice(0, count)
  if (units.length !== count) throw new Error(`Wrong source count: ${sheet}/${row}`)
  const h = calculateActualDimensions(units[0].dimensions, orientation, rotation, units[0].orientationVerticalAxes).height
  units.forEach((item, i) => put(item, { x, y, z: z + i * (h + 5) }, orientation, rotation))
}
const output = 'data/reconstruction/pdf-container-eleven-seed'
mkdirSync(output, { recursive: true })
const previousResult = readPreviousReplayResult(`${output}/result.json`)
try {
  // Same eight PDF racks, ordered to expose a continuous corridor beside short racks.
  const racks = [10,23,33,34,18,19,14,21]
  let x = 0
  for (const row of racks) { const item = take('玻璃架',row)[0]; put(item,{x,y:0,z:0},'standing',90); x += item.dimensions.width }
  pile('门窗',22,6,215,0,1328,'flat',90)
  pile('门窗',22,6,1703,0,1076,'flat',90)
  pile('门窗',22,6,3088,0,1598,'flat',90)
  pile('门窗',22,6,4475,0,928,'flat',90)
  // Ten 120kg sashes span the equally high racks. Balance contact area exactly
  // so the projected load is 600kg/rack, preserving the original top limits.
  const contactWidth = 2414.5 * 1304 / (1584.5 + 1304)
  pile('门窗',17,10,6896-contactWidth,0,1028,'flat')
  for (const y of [1595,1710]) for (const px of [0,1589.5]) pile('门窗',17,1,px,y,0,'standing')
  for (const y of [1846,1961,2076]) for (const px of [0,1589.5,3179]) pile('门窗',17,1,px,y,0,'standing')
  for (const px of [11059,11214,11369]) for (const y of [0,1035]) pile('门窗',15,1,px,y,0,'standing',90)
  pile('门窗',15,1,3179,1595,0,'standing')
  pile('门窗',15,1,8389,0,1048,'flat',90)
  pile('门窗',15,1,9775,0,1726,'flat',90)
  // Heavy ancillary cartons use the exposed floor corridor, not full racks.
  for (const px of [6901,7116,7331,7546]) pile('辅材',8,4,px,1590,0,'lying',90)
  pile('辅材',5,1,7761,1590,0,'flat',90)
  pile('辅材',16,2,8116,1590,0,'lying',90)
  pile('辅材',17,1,8116,1915,0,'lying')
  pile('辅材',41,3,6901,1310,0,'flat')
  pile('辅材',18,1,9424,0,1048,'lying')
  pile('辅材',21,1,9424,265,1048,'lying')
  pile('辅材',24,1,9424,630,1048,'lying',90)
  pile('辅材',27,1,9424,985,1048,'lying')
  pile('辅材',40,2,9424,1260,1048,'standing')
} catch (error) { console.error(error instanceof Error ? error.message : String(error)) }
const unpacked = items.filter(i => !used.has(i.id))
const solution = createPackingSolution([c], unpacked, 'PDF-P11-FIXED-ALLOCATION-RECONSTRUCTION', 0, Date.now() - start)
solution.validation = validateSolution(solution, items, calibration.config)
const result = { sourceContainerNumber: 11, sourceIds: allocation.ids, complete: unpacked.length === 0 && solution.validation.valid, config: calibration.config, solution, validation: solution.validation, provenance: researchCalibrationProvenance(calibration), construction: 'Same PDF manifest; analytically chosen coordinates with rack corridor and balanced top loads. Functional replay, not recovery of original hidden XYZ.', attempts, execution: finishRecord(), previousResult }
writeFileSync(`${output}/result.json`, JSON.stringify(result,null,2))
appendFileSync('data/reconstruction/process-journal.jsonl', `${JSON.stringify({ event: 'analytic-fixed-allocation-replay', sourceContainerNumber: 11, complete: result.complete, loaded: c.items.length, expected: items.length, validation: solution.validation, calibrationHash: calibration.calibrationHash, execution: result.execution, previousResult })}\n`)
console.log(JSON.stringify({ output, count: c.items.length, expected: items.length, unpacked: unpacked.map(i=>i.id), valid: solution.validation.valid, errors: solution.validation.errors.slice(0,5), complete: result.complete }))
