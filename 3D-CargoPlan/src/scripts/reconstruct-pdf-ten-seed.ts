// #created 11/08/2026
import { appendFileSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import type { CargoItem, Orientation, Position3D } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance } from '../core/research-calibration'
import { canPlaceAt, calculateActualDimensions, updateContainer, analyzeStacking } from '../core/packing-utils'
import { pairGeometryErrors } from '../core/solid-geometry'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { createPackingSolution } from '../core/solution-builder'
import { validateSolution } from '../core/validation'
import { superviseResearch } from './research-supervisor'

const output = 'data/reconstruction/pdf-container-ten-seed'
mkdirSync(output, { recursive: true })
if (!process.argv.includes('--child')) {
  const result = await superviseResearch({ modulePath: new URL(import.meta.url), args: ['--child'], budgetMs: 60000, candidateWallLimitMs: 55000, execArgv: ['--import', 'tsx'], inheritOutput: true })
  writeFileSync(`${output}/supervision.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ event: 'pdf-ten-supervision', ...result }))
  if (result.executionStatus !== 'finished') process.exitCode = result.executionStatus === 'failed' ? 1 : 124
} else {
  if (!process.send) throw new Error('Run this seed through its external supervisor')
  process.send({ type: 'candidate-start', trial: 10 })
  const calibration = loadResearchCalibration('data/reconstruction/model-v2-contract.json')
  const allocation = calibration.pdfAllocation.find(c => c.containerNumber === 10)!
  const items = allocation.ids.map(id => calibration.items.find(i => i.id === id)!)
  if (items.length !== 97 || items.some(i => !i)) throw new Error('The audited container ten must have exactly 97 original units')
  const c = createEmptyContainer(9, calibration.config, items)
  const used = new Set<string>(), attempts: unknown[] = [], start = Date.now()
  const take = (sheet: string, row: number) => items.filter(i => !used.has(i.id) && i.rawData._sourceSheet === sheet && i.rawData._sourceRow === row)
  const ledger = `${output}/attempts.jsonl`
  writeFileSync(ledger, '')
  function put(item: CargoItem, position: Position3D, orientation: Orientation, rotation = 0) {
    if (!item || used.has(item.id)) throw new Error('Missing or duplicate original source unit')
    const actualDimensions = calculateActualDimensions(item.dimensions, orientation, rotation, item.orientationVerticalAxes)
    const placed = { item, position, orientation, rotation, actualDimensions }
    const accepted = canPlaceAt(item, position, orientation, rotation, c)
    const diagnostic = accepted ? [] : [...c.items.flatMap(other => pairGeometryErrors(placed, other, c)), ...analyzeStacking([...c.items, placed], c.loadingRules).errors]
    const record = { step: attempts.length + 1, id: item.id, position, orientation, rotation, actualDimensions, accepted, diagnostic }
    attempts.push(record); appendFileSync(ledger, `${JSON.stringify(record)}\n`)
    if (!accepted) throw new Error(JSON.stringify(record))
    c.items.push(placed); used.add(item.id); updateContainer(c)
  }
  function pile(sheet: string, row: number, count: number, x: number, y: number, z: number, orientation: Orientation, rotation = 0) {
    const units = take(sheet, row).slice(0, count)
    if (units.length !== count) throw new Error(`Wrong fixed allocation count ${sheet}/${row}/${count}`)
    const h = calculateActualDimensions(units[0].dimensions, orientation, rotation, units[0].orientationVerticalAxes).height
    units.forEach((item, i) => put(item, { x, y, z: z + i * (h + 5) }, orientation, rotation))
  }
  let constructionError: string | undefined
  try {
    // Three unrotated racks leave a continuous side corridor. Tall W02 units
    // stay on the floor; the lighter W01 frame piles use the two lower racks.
    put(take('玻璃架', 7)[0], { x: 0, y: 0, z: 0 }, 'standing')
    put(take('玻璃架', 11)[0], { x: 2480, y: 0, z: 0 }, 'standing')
    put(take('玻璃架', 16)[0], { x: 4694, y: 0, z: 0 }, 'standing')
    pile('门窗', 22, 6, 0, 0, 1650, 'flat')
    pile('门窗', 21, 9, 2485, 0, 1378, 'flat')
    pile('门窗', 21, 12, 4699, 0, 1028, 'flat')

    // W11/W12 are upright on the floor, never supporting another door.
    for (const x of [0, 1035]) for (const y of [1187, 1342, 1497, 1652, 1807, 1962]) {
      const item = take('门窗', 14)[0] ?? take('门窗', 15)[0]
      put(item, { x, y, z: 0 }, 'standing')
    }
    put(take('门窗', 17)[0], { x: 0, y: 2117, z: 0 }, 'standing')
    // W06 cannot stand under the net height; five separate side-lying sashes.
    for (const y of [1679, 1794, 1909, 2024, 2139]) pile('门窗', 20, 1, 2485, y, 0, 'lying')

    // Two mandatory floor crates; their light auxiliary units go on the lids.
    put(take('辅材', 28)[0], { x: 6872, y: 0, z: 0 }, 'standing')
    put(take('辅材', 29)[0], { x: 8077, y: 0, z: 0 }, 'standing')

    // Remaining 36 W02 upright floor units occupy the residual corridors.
    for (let i = 0; i < 20; i++) pile('门窗', 17, 1, 9282 + i * 115, 0, 0, 'standing', 90)
    for (const y of [1589.5, 1704.5, 1819.5, 1934.5]) pile('门窗', 17, 1, 9282, y, 0, 'standing')
    for (const x of [5144.5, 6734]) for (const y of [1679, 1794, 1909, 2024, 2139]) pile('门窗', 17, 1, x, y, 0, 'standing')
    for (const y of [1205, 1320]) pile('门窗', 17, 1, 6872, y, 0, 'standing')

    // The crate lids accept only light units, largest face down; total <=200kg.
    pile('辅材', 8, 3, 6872, 0, 1205, 'standing')
    pile('辅材', 8, 3, 8077, 0, 1205, 'standing')
    pile('辅材', 6, 2, 7477, 0, 1205, 'flat')
    pile('辅材', 16, 1, 6872, 615, 1205, 'standing')
    pile('辅材', 24, 1, 7197, 615, 1205, 'standing')
    pile('辅材', 40, 1, 7552, 615, 1205, 'standing')
  } catch (error) {
    constructionError = error instanceof Error ? error.message : String(error)
    console.error(constructionError)
  }
  const unpacked = items.filter(i => !used.has(i.id))
  const solution = createPackingSolution([c], unpacked, 'PDF-P10-FIXED-ALLOCATION-SEED', 0, Date.now() - start)
  solution.validation = validateSolution(solution, items, calibration.config)
  const complete = unpacked.length === 0 && solution.validation.valid
  const result = {
    sourceContainerNumber: 10, sourceIds: allocation.ids, complete, config: calibration.config, solution, validation: solution.validation, provenance: researchCalibrationProvenance(calibration),
    construction: 'Analytic fixed-allocation construction, with W11/W12 individually upright. Same original 97 units, no cross-container moves, no claim of recovering exact raster-hidden XYZ.',
    methodSteps: [
      'Freeze the original 97 normalizedIds and the explicit v2 contract; no cross-container exchange.',
      'Put the three racks unrotated in descending height order; place six W01 sashes as one source-permitted six-unit flat pile on the tallest rack (600kg).',
      'Use the two lower rack tops for nine and twelve light W01 frames (144/192kg), retaining real rail coverage and center checks.',
      'Put all five W11 and seven W12 individually upright on the floor. Their <=5kg top-unit limit is unchanged.',
      'Put all five W06 separately side-lying on the floor, and all 37 W02 individually upright in the remaining corridors.',
      'Keep both heavy crates on the floor; put only light auxiliary units largest-face-down on the lids, preserving unit and total loads.',
      'Check every insertion with canPlaceAt, then independently validate the entire fixed allocation and its aggregate statistics.'
    ],
    rejectedConstructionHypotheses: [
      { kind: 'previous-executed-local-fixture', description: 'W02 flat at (2480,0,1378) on rack7 was rejected at step10: insufficient 5mm clearance from adjacent taller rack3; first attempt stopped with nine accepted units, not a complete layout.' },
      { kind: 'analytic-geometry-review', description: 'Five-layer flat W02 piles on adjacent 7/12 racks would have overlapping horizontal overhang and intersecting vertical ranges; the final construction instead assigns those rack tops to lighter short frames.' }
    ],
    attempts, constructionError, elapsedMs: Date.now() - start
  }
  writeFileSync(`${output}/result.json.tmp`, JSON.stringify(result, null, 2)); renameSync(`${output}/result.json.tmp`, `${output}/result.json`)
  console.log(JSON.stringify({ output, count: c.items.length, expected: items.length, unpacked: unpacked.map(i => i.id), valid: solution.validation.valid, errors: solution.validation.errors.slice(0, 5), complete, elapsedMs: result.elapsedMs }))
  process.send({ type: 'candidate-finish', trial: 10 }); process.send({ type: 'research-finished', status: 'analytic-construction-finished' })
  if (!complete) process.exitCode = 2
}
