// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import type { CargoItem, Orientation, PlacedItem, Position3D } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance } from '../core/research-calibration'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, tryPlaceItem, updateContainer } from '../core/packing-utils'
import { pairGeometryErrors } from '../core/solid-geometry'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { createPackingSolution } from '../core/solution-builder'
import { validateSolution } from '../core/validation'
import { superviseResearch } from './research-supervisor'

const number = Number(process.argv[2] ?? 4)
if (![4, 5].includes(number)) throw new Error('This fixed-allocation seed supports only original containers 4 and 5')
const output = `data/reconstruction/v3/container-${number}`
mkdirSync(output, { recursive: true })
if (!process.argv.includes('--child')) {
  const supervision = await superviseResearch({ modulePath: new URL(import.meta.url), args: [String(number), '--child'], budgetMs: 60000, candidateWallLimitMs: 55000, execArgv: ['--import', 'tsx'], inheritOutput: true })
  writeFileSync(`${output}/supervision.json`, JSON.stringify(supervision, null, 2))
  console.log(JSON.stringify({ sourceContainerNumber: number, supervision }))
  if (supervision.executionStatus !== 'finished') process.exitCode = supervision.executionStatus === 'failed' ? 1 : 124
} else {
  if (!process.send) throw new Error('Run through the external supervisor')
  process.send({ type: 'candidate-start', trial: number })
  const calibration = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
  const allocation = calibration.pdfAllocation.find(c => c.containerNumber === number)!
  const items = allocation.ids.map(id => calibration.items.find(i => i.id === id)!)
  const c = createEmptyContainer(number - 1, calibration.config, items), used = new Set<string>(), attempts: unknown[] = [], start = Date.now()
  const take = (sheet: string, row: number) => items.filter(i => !used.has(i.id) && i.rawData._sourceSheet === sheet && i.rawData._sourceRow === row)
  writeFileSync(`${output}/attempts.jsonl`, '')
  function put(item: CargoItem, position: Position3D, orientation: Orientation, rotation = 0): PlacedItem {
    if (!item || used.has(item.id)) throw new Error('Missing or duplicate source unit')
    const placed = { item, position, orientation, rotation, actualDimensions: calculateActualDimensions(item.dimensions, orientation, rotation, item.orientationVerticalAxes) }
    const accepted = canPlaceAt(item, position, orientation, rotation, c)
    const diagnostic = accepted ? [] : [...c.items.flatMap(other => pairGeometryErrors(placed, other, c)), ...analyzeStacking([...c.items, placed], c.loadingRules).errors]
    const record = { step: attempts.length + 1, id: item.id, ...position, orientation, rotation, accepted, diagnostic }
    attempts.push(record); appendFileSync(`${output}/attempts.jsonl`, `${JSON.stringify(record)}\n`)
    if (!accepted) throw new Error(JSON.stringify(record))
    c.items.push(placed); used.add(item.id); updateContainer(c)
    return placed
  }
  function pile(sheet: string, row: number, count: number, x: number, y: number, z: number, orientation: Orientation, rotation = 0) {
    const units = take(sheet, row).slice(0, count)
    if (units.length !== count) throw new Error(`Fixed allocation mismatch ${sheet}/${row}/${count}`)
    const h = calculateActualDimensions(units[0].dimensions, orientation, rotation, units[0].orientationVerticalAxes).height
    return units.map((item, i) => put(item, { x, y, z: z + i * (h + 5) }, orientation, rotation))
  }
  let constructionError: string | undefined
  try {
    if (number === 4) {
      pile('门窗', 23, 10, 0, 0, 0, 'flat')
      const hosts: PlacedItem[] = []
      for (const y of [995, 1210, 1425, 1640]) hosts.push(...pile('门窗', 23, 2, 0, y, 0, 'lying'))
      for (const y of [1855, 1970, 2085]) pile('门窗', 25, 10, 0, y, 0, 'lying')
      // Nineteen small cartons rest on the floor inside a real flat-frame hole.
      for (const y of [105, 470]) for (let j = 0; j < 6; j++) pile('辅材', 12, 1, 1805 + j * 265, y, 0, 'standing')
      for (let j = 0; j < 7; j++) pile('辅材', 25, 1, 3395 + (j % 4) * 225, 105 + Math.floor(j / 4) * 305, 0, 'standing')
      // Strictly lying doors can use the taller through-opening of a lying host.
      pile('门窗', 24, 2, 1805, hosts[0].position.y, 105, 'lying')
      for (const [i, row] of [10, 19, 31, 34, 38, 43].entries()) pile('辅材', row, 1, 1805 + i * 305, hosts[2].position.y, 105, 'lying')
      const w02: PlacedItem[] = []
      for (let j = 0; j < 10; j++) w02.push(...pile('门窗', 16, 1, 6605, j * 165, 0, 'lying'))
      for (let j = 0; j < 38; j++) {
        const host = w02[Math.floor(j / 4)], slot = j % 4
        pile('门窗', 8, 1, host.position.x + 920 + (slot % 2) * 535, host.position.y, 185 + Math.floor(slot / 2) * 535, 'lying')
      }
      pile('门窗', 18, 9, 6605, 1650, 0, 'lying')
      for (const y of [1865, 1990]) pile('门窗', 9, 1, 6605, y, 0, 'lying')
      pile('门窗', 20, 1, 6605, 2115, 0, 'lying')
      pile('玻璃架', 22, 1, 9640, 0, 0, 'standing', 90)
      pile('门窗', 7, 8, 9640, 0, 1308, 'flat')
      for (const y of [1035, 1160, 1285, 1410]) pile('门窗', 6, 1, 9640, y, 1308, 'lying')
      for (const x of [11133, 11288, 11443]) for (const y of [0, 1035]) pile('门窗', 15, 1, x, y, 0, 'standing', 90)
    } else {
      pile('玻璃架', 27, 1, 0, 0, 0, 'standing')
      pile('玻璃架', 9, 1, 3204, 0, 0, 'standing')
      pile('玻璃架', 13, 1, 5684, 0, 0, 'standing')
      pile('门窗', 23, 10, 3209, 1255, 0, 'flat')
      pile('门窗', 21, 12, 0, 0, 1089, 'flat')
      for (const y of [1679, 1794, 1909]) pile('门窗', 21, 1, 0, y, 0, 'standing')
      for (const y of [0, 215, 430]) pile('门窗', 18, 3, 3209, y, 1650, 'lying')
      for (const y of [645, 900]) pile('门窗', 18, 6, 5689, y, 1048, 'flat')
      pile('门窗', 18, 3, 8362, 0, 0, 'lying')
      pile('门窗', 5, 1, 2099, 0, 1089, 'standing', 90)
      const host = pile('门窗', 16, 1, 0, 2090, 0, 'lying')[0]
      for (const x of [920, 1455]) pile('门窗', 8, 1, x, host.position.y, 185, 'lying')
      pile('辅材', 30, 1, 9814, 1050, 0, 'standing')
      for (let j = 0; j < 7; j++) pile('门窗', 21, 1, 9814, 215 + j * 115, 0, 'standing')
      for (let j = 0; j < 6; j++) pile('门窗', 14, 1, 8694, 215 + j * 155, 0, 'standing')
      pile('辅材', 8, 1, 9814, 1050, 1205, 'standing')
      pile('辅材', 23, 1, 10419, 1050, 1205, 'standing')
      pile('辅材', 25, 1, 10734, 1050, 1205, 'standing')
      pile('辅材', 26, 1, 9814, 1665, 1205, 'standing')
      pile('辅材', 35, 1, 10119, 1665, 1205, 'standing')
      pile('辅材', 39, 1, 10414, 1665, 1205, 'standing')
      // Five long light bars balance over the shorter 5# rack.
      pile('门窗', 10, 3, 2480, 645, 1650, 'lying')
      pile('门窗', 10, 2, 2480, 950, 1650, 'lying')
    }
  } catch (error) { constructionError = error instanceof Error ? error.message : String(error); console.error(constructionError) }
  const deadline = Date.now() + 10000
  for (const item of items.filter(i => !used.has(i.id))) {
    const placed = tryPlaceItem(item, c, deadline)
    if (placed) put(item, placed.position, placed.orientation, placed.rotation)
  }
  const unpacked = items.filter(i => !used.has(i.id)), solution = createPackingSolution([c], unpacked, `PDF-P${number}-FIXED-ALLOCATION-SEED`, 0, Date.now() - start)
  solution.validation = validateSolution(solution, items, calibration.config)
  const result = { sourceContainerNumber: number, sourceIds: allocation.ids, complete: solution.validation.valid && !unpacked.length, config: calibration.config, solution, validation: solution.validation, provenance: { ...researchCalibrationProvenance(calibration), scriptSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), executionCommand: `node --import tsx src/scripts/reconstruct-pdf-four-five-v3.ts ${number}`, cpu: process.cpuUsage() }, construction: 'Bounded analytic partial hypothesis under v3 centroid-hull rules, strict original-width-vertical cavity doors. Fixed original allocation; no cross-container moves; not an infeasibility proof.', attempts, constructionError, elapsedMs: Date.now() - start }
  writeFileSync(`${output}/result.json.tmp`, JSON.stringify(result, null, 2)); renameSync(`${output}/result.json.tmp`, `${output}/result.json`)
  console.log(JSON.stringify({ sourceContainerNumber: number, expected: items.length, loaded: c.items.length, unpacked: unpacked.map(i => i.id), valid: solution.validation.valid, errors: solution.validation.errors, complete: result.complete, elapsedMs: result.elapsedMs }))
  process.send({ type: 'candidate-finish', trial: number }); process.send({ type: 'research-finished', status: 'analytic-partial-finished' })
}
