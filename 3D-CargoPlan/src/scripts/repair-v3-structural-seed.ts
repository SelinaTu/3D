// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { updateContainer } from '../core/packing-utils'
import { placeResearchItem } from '../core/research-placement'
import { assessResearchCandidate } from '../core/research-metrics'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { createPackingSolution } from '../core/solution-builder'
import { startReplayRecord } from './replay-run-record'
import type { PackingSolution } from '../types/packing'

const finish = startReplayRecord(import.meta.url), cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json'), input = process.argv[2] ?? 'data/optimization/v3-rack-rotation/seed.json', source = JSON.parse(readFileSync(input, 'utf8')) as { solution: PackingSolution }, output = 'data/optimization/v3-rack-rotation/greedy-repair', deadline = Date.now() + 24000
mkdirSync(output, { recursive: true })
let best = assessResearchCandidate(source.solution, cal.items, cal.config)
const trials: unknown[] = []
for (const trial of [0, 1, 2, 3]) {
  if (Date.now() >= deadline) break
  const containers = structuredClone(source.solution.containers), used = new Set(containers.flatMap(c => c.items.map(p => p.item.id))), moves: unknown[] = []
  const pool = [...source.solution.unpackedItems].sort((a, b) => trial % 2 ? b.dimensions.length - a.dimensions.length : a.dimensions.length - b.dimensions.length)
  for (const pass of [0, 1]) for (const item of pool) {
    if (used.has(item.id) || Date.now() >= deadline) continue
    const order = trial < 2 ? [8, ...containers.map((_, i) => i).filter(i => i !== 8)] : containers.map((_, i) => i).reverse()
    for (const bi of order) {
      const p = placeResearchItem(item, containers[bi], 3 + pass, Math.min(deadline, Date.now() + 80))
      if (p) { containers[bi].items.push(p); updateContainer(containers[bi]); used.add(item.id); moves.push({ id: item.id, bin: bi + 1, position: p.position, orientation: p.orientation, rotation: p.rotation }); break }
    }
  }
  const assessed = assessResearchCandidate(createPackingSolution(containers, cal.items.filter(i => !used.has(i.id)), 'V3-RACK-ROTATION-RESIDUAL-INSERTION', 0, 0), cal.items, cal.config)
  trials.push({ trial, moves, loaded: used.size, validation: assessed.validation })
  if (assessed.validation.valid && used.size > best.metrics.placedItems) best = assessed
}
writeFileSync(`${output}/result.json`, JSON.stringify({ provenance: { ...researchCalibrationProvenance(cal), input, inputSha256: researchFileHash(input) }, config: cal.config, ...best, trials, execution: finish() }, null, 2))
console.log(JSON.stringify({ output, loaded: best.metrics.placedItems, missing: best.metrics.unpackedItems, valid: best.validation.valid }))
