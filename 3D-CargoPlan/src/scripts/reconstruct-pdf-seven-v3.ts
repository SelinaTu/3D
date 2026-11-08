// #created 11/08/2026
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { Orientation } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance } from '../core/research-calibration'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, updateContainer } from '../core/packing-utils'
import { pairGeometryErrors } from '../core/solid-geometry'
import { createEmptyContainer } from '../core/greedy-algorithm'
import { createPackingSolution } from '../core/solution-builder'
import { validateSolution } from '../core/validation'
import { reconstructOneContainer } from '../core/reconstruction-decoder'
import { superviseResearch } from './research-supervisor'

const output = 'data/reconstruction/v3/container-7'
mkdirSync(output, { recursive: true })
if (!process.argv.includes('--child')) {
  const supervision = await superviseResearch({ modulePath: new URL(import.meta.url), args: ['--child'], budgetMs: 10000, candidateWallLimitMs: 9000, execArgv: ['--import', 'tsx'], inheritOutput: true })
  writeFileSync(`${output}/supervision.json`, JSON.stringify(supervision, null, 2))
  console.log(JSON.stringify(supervision))
} else {
  if (!process.send) throw new Error('External supervisor required')
  process.send({ type: 'candidate-start', trial: 7 })
  const calibration = loadResearchCalibration('data/reconstruction/model-v3-contract.json'), allocation = calibration.pdfAllocation.find(c => c.containerNumber === 7)!
  const items = allocation.ids.map(id => calibration.items.find(i => i.id === id)!), c = createEmptyContainer(6, calibration.config, items), used = new Set<string>(), attempts: unknown[] = [], start = Date.now()
  function pile(sheet: string, row: number, count: number, x: number, y: number, z: number, orientation: Orientation, rotation = 0) {
    const units = items.filter(i => i.rawData._sourceSheet === sheet && i.rawData._sourceRow === row && !used.has(i.id)).slice(0, count)
    if (units.length !== count) throw new Error('Fixed allocation count mismatch')
    const d = calculateActualDimensions(units[0].dimensions, orientation, rotation, units[0].orientationVerticalAxes)
    for (const [j, item] of units.entries()) {
      const position = { x, y, z: z + j * (d.height + 5) }, placed = { item, position, orientation, rotation, actualDimensions: d }, accepted = canPlaceAt(item, position, orientation, rotation, c)
      const record = { id: item.id, position, orientation, rotation, accepted, errors: accepted ? [] : [...c.items.flatMap(q => pairGeometryErrors(placed, q, c)), ...analyzeStacking([...c.items, placed], c.loadingRules).errors] }
      attempts.push(record)
      if (!accepted) throw new Error(JSON.stringify(record))
      c.items.push(placed); used.add(item.id); updateContainer(c)
    }
  }
  let constructionError: string | undefined
  try {
    pile('玻璃架', 5, 1, 0, 0, 0, 'standing'); pile('玻璃架', 6, 1, 2720, 0, 0, 'standing'); pile('玻璃架', 32, 1, 5440, 0, 0, 'standing')
    pile('门窗', 7, 6, 0, 0, 1650, 'flat', 90); pile('门窗', 5, 6, 1035, 0, 1650, 'flat', 90)
    pile('门窗', 7, 6, 2720, 0, 1650, 'flat', 90); pile('门窗', 5, 5, 3755, 0, 1650, 'flat', 90)
    pile('门窗', 20, 4, 5445, 0, 1039, 'flat')
  } catch (e) { constructionError = e instanceof Error ? e.message : String(e) }
  const save = (solution: ReturnType<typeof createPackingSolution>, stage: string) => {
    const validation = validateSolution(solution, items, calibration.config)
    const result = {
      sourceContainerNumber: 7, sourceIds: allocation.ids, config: calibration.config, solution, validation, complete: validation.valid && !solution.unpackedItems.length, provenance: researchCalibrationProvenance(calibration), engineFiles: ['src/core/packing-utils.ts', 'src/core/solid-geometry.ts', 'src/core/validation.ts', 'src/core/loading-profile.ts', 'src/scripts/reconstruct-pdf-seven-v3.ts'].map(path => ({path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex')})), attempts, constructionError, stage, elapsedMs: Date.now() - start, notAnInfeasibilityProof: true,
      fixedMacroDiagnostic: {
        kind: 'conditional-floor-area-shortfall', notGlobalInfeasibility: true,
        floorCapacityM2: 26.1,
        floorAreaM2: { threeRacks: 9.530812, nineteenW02Frames: 9.2112, tenW07: 3.636, seventeenW11Upright: 2.6265, fourW06Lying: 1.16798, baseTotal: 26.172492, twoSameSourceTwoHighW04LyingColumns: .3192, includingFourRemainingW04: 26.491692 },
        explanation: 'This bound applies only while the recorded rack-top groups remain fixed. W04 rows 6 and 7 each permit a two-high lying floor column; the bound accounts for that stacking rather than summing four individual footprints. Ancillary floor space and gaps are omitted. Reassigning rack-top cargo changes the premise, so this is not proof against the original PDF allocation.'
      }
    }
    writeFileSync(`${output}/result.json.tmp`, JSON.stringify(result, null, 2)); renameSync(`${output}/result.json.tmp`, `${output}/result.json`)
    console.log(JSON.stringify({ stage, loaded: solution.stats?.placedItems, unpacked: solution.unpackedItems.map(i => i.id), valid: validation.valid, complete: result.complete, elapsedMs: result.elapsedMs }))
  }
  save(createPackingSolution([c], items.filter(i => !used.has(i.id)), 'PDF-P7-ANALYTIC-RACK-TOPS', 0, Date.now() - start), 'analytic-rack-top-seed')
  if (!constructionError) {
    const solution = reconstructOneContainer(items, calibration.config, { seed: 202610177, order: 'rigidity', columnMode: 'single', rackYaw: 0, rackChain: false, reversePoints: false }, Date.now() + 7000, c)
    save(solution, 'single-bounded-repair')
  }
  process.send({ type: 'candidate-finish', trial: 7 }); process.send({ type: 'research-finished', status: 'single-repair-finished' })
}
