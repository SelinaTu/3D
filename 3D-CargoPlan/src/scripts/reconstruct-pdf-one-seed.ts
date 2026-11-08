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
const allocation = calibration.pdfAllocation.find(c => c.containerNumber === 1)!
const items = calibration.items.filter(i => allocation.ids.includes(i.id))
const c = createEmptyContainer(0, calibration.config, items)
const used = new Set<string>(), attempts: unknown[] = [], start = Date.now()
const take = (sheet: string, row: number) => items.filter(i => !used.has(i.id) && i.rawData._sourceSheet === sheet && i.rawData._sourceRow === row)
function put(item: CargoItem, p: Position3D, orientation: Orientation, rotation = 0) {
  const d = calculateActualDimensions(item.dimensions, orientation, rotation, item.orientationVerticalAxes)
  const placed = { item, position: p, orientation, rotation, actualDimensions: d }
  const accepted = canPlaceAt(item, p, orientation, rotation, c)
  const diagnostic = accepted ? [] : [...c.items.flatMap(other => pairGeometryErrors(placed, other, c)), ...analyzeStacking([...c.items, placed], c.loadingRules).errors]
  attempts.push({ id: item.id, position: p, orientation, rotation, accepted, diagnostic })
  if (!accepted) throw new Error(JSON.stringify(attempts.at(-1)))
  c.items.push(placed); used.add(item.id); updateContainer(c)
}
function pile(sheet: string, row: number, count: number, x: number, y: number, z: number, orientation: Orientation, rotation = 0) {
  const units = take(sheet, row).slice(0, count)
  if (units.length !== count) throw new Error(`Wrong source count: ${sheet}/${row}`)
  const h = calculateActualDimensions(units[0].dimensions, orientation, rotation, units[0].orientationVerticalAxes).height
  units.forEach((item, i) => put(item, { x, y, z: z + i * (h + 5) }, orientation, rotation))
}
const output = 'data/reconstruction/pdf-container-one-seed'
mkdirSync(output, { recursive: true })
const previousResult = readPreviousReplayResult(`${output}/result.json`)
try {
  // PDF p2: three equally high racks, followed by two ten-frame flat piles.
  ;[24,25,26].forEach((row, i) => put(take('玻璃架', row)[0], { x: i * 1488, y: 0, z: 0 }, 'standing', 90))
  pile('门窗',23,10,4469,0,0,'flat'); pile('门窗',23,10,4469,995,0,'flat')
  // The rear 220 mm corridor accommodates three flat piles of eight W09.
  for (const x of [0,3615,7230]) pile('门窗',12,8,x,1990,0,'flat')
  pile('门窗',12,6,0,1005,1076,'lying')
  put(take('门窗',16)[0], { x:0,y:1825,z:0 }, 'lying')
  put(take('门窗',5)[0], { x:0,y:0,z:1076 }, 'standing')
  put(take('门窗',15)[0], { x:3035,y:1835,z:0 }, 'standing')
  pile('门窗',18,4,0,200,1076,'flat')
  for (const [y,n] of [[500,12],[605,12],[710,12],[815,10]]) pile('门窗',11,n,0,y,1076,'lying')
  for (const [y,n] of [[1310,12],[1395,12],[1480,7]]) pile('门窗',13,n,1884,y,1076,'lying')
  pile('门窗',24,9,11074,0,0,'flat',90); pile('门窗',24,8,11329,0,0,'flat',90)
  for (const x of [920,1455]) pile('门窗',8,1,x,1845,185,'lying')
  pile('辅材',7,1,6274,105,0,'standing')
  pile('辅材',14,1,3005,500,1076,'lying')
  pile('辅材',20,3,3500,500,1076,'standing')
  pile('辅材',40,3,3005,0,1076,'standing')
} catch (error) { console.error(error instanceof Error ? error.message : String(error)) }
const unpacked = items.filter(i => !used.has(i.id))
const solution = createPackingSolution([c], unpacked, 'PDF-P1-MACRO-RECONSTRUCTION', 0, Date.now() - start)
solution.validation = validateSolution(solution, items, calibration.config)
const result = { sourceContainerNumber: 1, sourceIds: allocation.ids, complete: unpacked.length === 0 && solution.validation.valid, config: calibration.config, solution, validation: solution.validation, provenance: researchCalibrationProvenance(calibration), construction: 'PDF p1/p2 macro strategy, analytically chosen coordinates independently audited; no claim to have recovered raster-hidden exact original XYZ.', attempts, execution: finishRecord(), previousResult }
writeFileSync(`${output}/result.json`, JSON.stringify(result,null,2))
appendFileSync('data/reconstruction/process-journal.jsonl', `${JSON.stringify({ event: 'analytic-fixed-allocation-replay', sourceContainerNumber: 1, complete: result.complete, loaded: c.items.length, expected: items.length, validation: solution.validation, calibrationHash: calibration.calibrationHash, execution: result.execution, previousResult })}\n`)
console.log(JSON.stringify({ output, count: c.items.length, expected: items.length, unpacked: unpacked.map(i=>i.id), valid: solution.validation.valid, errors: solution.validation.errors.slice(0,5), complete: result.complete }))
