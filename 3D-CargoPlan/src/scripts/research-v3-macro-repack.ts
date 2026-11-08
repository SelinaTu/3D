// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { CargoItem, PackingSolution } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash, compareResearchWithPdf, researchReallocation } from '../core/research-calibration'
import { assessResearchCandidate, canonicalResearchSolution, researchHash } from '../core/research-metrics'
import { createPackingSolution } from '../core/solution-builder'
import { updateContainer, volume } from '../core/packing-utils'
import { placeTallLongFrameMacro } from '../core/research-long-frame-macro'
import { placeResearchItem } from '../core/research-placement'
import { superviseResearch } from './research-supervisor'

const output = 'data/optimization/v3-macro-repack'; mkdirSync(output, { recursive: true })
if (!process.send) {
  const supervision = await superviseResearch({ modulePath: new URL(import.meta.url), args: ['--child'], execArgv: ['--import', 'tsx'], budgetMs: 120000, candidateWallLimitMs: 60000, inheritOutput: true })
  writeFileSync(`${output}/supervision.json`, JSON.stringify(supervision, null, 2))
  console.log(JSON.stringify({ event: 'macro-repack-supervision', ...supervision }))
} else {
  const calibration = loadResearchCalibration('data/reconstruction/model-v3-contract.json'), { config, items } = calibration, started = Date.now(), deadline = started + 116000
  const sourcePath = 'data/optimization/v3-repair-11/best-partial.json', original = JSON.parse(readFileSync(sourcePath, 'utf8')) as { solution: PackingSolution }
  const engineFiles = ['src/scripts/research-v3-macro-repack.ts', 'src/core/research-long-frame-macro.ts', 'src/core/research-placement.ts', 'src/core/packing-utils.ts', 'src/core/solid-geometry.ts', 'src/core/validation.ts'].map(path => ({ path, sha256: researchFileHash(path) }))
  const provenance = { ...researchCalibrationProvenance(calibration), engineFiles, engineSha256: researchHash(engineFiles), sourcePath, sourceSha256: researchFileHash(sourcePath), seed: 20261018 }
  let bestLoaded = 0
  for (let trial = 0; trial < 2 && Date.now() < deadline; trial++) {
    process.send({ type: 'candidate-start', trial })
    const start = Date.now(), until = Math.min(deadline, start + 55000), containers = structuredClone(original.solution.containers), macros: unknown[] = []
    const thin = containers.flatMap(c => c.items.filter(p => p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === 25).map(p => p.item)) as CargoItem[]
    thin.push(...original.solution.unpackedItems.filter((i: CargoItem) => i.rawData._sourceSheet === '门窗' && i.rawData._sourceRow === 25))
    if (thin.length !== 46 || new Set(thin.map(i => i.id)).size !== 46) throw new Error('All 46 long thin units must be accounted for')
    containers.forEach(c => { c.items = c.items.filter(p => !(p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === 25)); updateContainer(c) })
    for (const [j, index] of [1, 2].entries()) {
      const c = containers[index], longs = c.items.filter(p => p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === 23).map(p => p.item)
      if (longs.length !== 22) throw new Error(`Expected original 22-frame fixed source at index ${index}`)
      c.items = c.items.filter(p => p.position.x >= 6600); updateContainer(c)
      const macro = placeTallLongFrameMacro(c, longs, thin.slice(j * 20, (j + 1) * 20)); macros.push({ index, ...macro })
      if (!macro.accepted) throw new Error(JSON.stringify({ index, rejection: macro.rejection }))
    }
    const loaded = new Set(containers.flatMap(c => c.items.map(p => p.item.id)))
    let pool = items.filter(i => !loaded.has(i.id)); const moves: unknown[] = []
    const initial = pool.length
    // Give the real long-frame cavities their compatible small units before floor fill.
    pool.sort((a, b) => Number(a.dimensions.length > 3000) - Number(b.dimensions.length > 3000) || (trial ? volume(b.dimensions) - volume(a.dimensions) : volume(a.dimensions) - volume(b.dimensions)))
    for (let pass = 0; pass < 3 && pool.length && Date.now() < until; pass++) {
      const remaining: CargoItem[] = []
      for (const item of pool) {
        if (Date.now() >= until) { remaining.push(item); continue }
        const bins = [...containers].sort((a, b) => pass === 0 ? Number(b === containers[1] || b === containers[2]) - Number(a === containers[1] || a === containers[2]) : a.volumeUtilization - b.volumeUtilization)
        let found = false
        for (const c of bins) {
          const p = placeResearchItem(item, c, 3 + trial, Math.min(until, Date.now() + 220))
          if (p) { c.items.push(p); updateContainer(c); moves.push({ id: item.id, target: c.id, position: p.position, orientation: p.orientation, rotation: p.rotation, pass }); found = true; break }
        }
        if (!found) remaining.push(item)
      }
      pool = remaining.sort((a, b) => volume(b.dimensions) - volume(a.dimensions))
    }
    const solution = createPackingSolution(containers, pool, `V3-NEW-LONG-FRAME-MACRO-${trial}`, 0, Date.now() - start), assessed = assessResearchCandidate(solution, items, config)
    const record = { trial, initialPool: initial, loaded: assessed.metrics.placedItems, missing: pool.length, elapsedMs: Date.now() - start, valid: assessed.validation.valid, complete: assessed.metrics.eligible, macros, moves, missingIds: pool.map(i => i.id), errors: assessed.validation.errors }
    appendFileSync(`${output}/ledger.jsonl`, `${JSON.stringify(record)}\n`)
    const result = { provenance, config, solution, validation: assessed.validation, metrics: assessed.metrics, record, pdfComparison: compareResearchWithPdf(assessed.metrics, calibration) }
    writeFileSync(`${output}/candidate-${trial}.json`, JSON.stringify(result, null, 2))
    if (assessed.validation.valid && assessed.metrics.placedItems > bestLoaded) { bestLoaded = assessed.metrics.placedItems; writeFileSync(`${output}/best-partial.json`, JSON.stringify(result, null, 2)) }
    if (assessed.metrics.eligible) { result.solution = canonicalResearchSolution(assessed); writeFileSync(`${output}/best-complete.json`, JSON.stringify({ ...result, reallocation: researchReallocation(result.solution, calibration) }, null, 2)); break }
    console.log(JSON.stringify({ event: 'macro-repack-candidate', trial, loaded: record.loaded, missing: record.missing, valid: record.valid, elapsedMs: record.elapsedMs }))
    process.send({ type: 'candidate-finish', trial })
  }
  process.send({ type: 'research-finished', status: Date.now() >= deadline ? 'budget-exhausted' : 'trial-limit' })
}
