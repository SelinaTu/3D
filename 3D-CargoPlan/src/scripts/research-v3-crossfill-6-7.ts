// #created 11/08/2026
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Container } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance } from '../core/research-calibration'
import { placeResearchItem } from '../core/research-placement'
import { updateContainer } from '../core/packing-utils'
import { loadingRulesFor } from '../core/loading-profile'
import { createPackingSolution } from '../core/solution-builder'
import { validateSolution } from '../core/validation'
const started = Date.now(), calibration = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const seeds = Array.from({ length: 11 }, (_, i) => {
  const path = `data/reconstruction/v3/container-${i + 1}/result.json`, bytes = readFileSync(path), result = JSON.parse(bytes.toString())
  return { source: i + 1, path, sha256: createHash('sha256').update(bytes).digest('hex'), result }
})
const containers = seeds.map(s => ({ ...structuredClone(s.result.solution.containers[0]), loadingRules: loadingRulesFor(calibration.items, calibration.config) })) as Container[]
const pending = seeds.filter(s => s.source === 6 || s.source === 7).flatMap(s => s.result.solution.unpackedItems.map((i: {id:string}) => ({ source: s.source, item: calibration.items.find(q => q.id === i.id)! })))
const accepted: unknown[] = [], attempts: unknown[] = [], placed = new Set(containers.flatMap(c => c.items.map(p => p.item.id)))
for (const mode of [0, 3, 1, 4]) for (const entry of pending) {
  if (Date.now() - started > 30000) break
  if (placed.has(entry.item.id)) continue
  for (const j of [0, 1, 2, 3, 4, 7, 8, 9, 10, 5, 6]) {
    const c = containers[j], before = Date.now(), p = placeResearchItem(entry.item, c, mode, Math.min(started + 30000, before + 300))
    attempts.push({ itemId: entry.item.id, targetSourceContainer: j + 1, mode, accepted: !!p, elapsedMs: Date.now() - before })
    if (p) { c.items.push(p); updateContainer(c); placed.add(entry.item.id); accepted.push({ itemId: entry.item.id, sourceContainer: entry.source, targetSourceContainer: j + 1, position: p.position, orientation: p.orientation, rotation: p.rotation }); break }
  }
}
const solution = createPackingSolution(containers, calibration.items.filter(i => !placed.has(i.id)), 'V3-CROSSFILL-FROM-6-7', 0, Date.now() - started), validation = validateSolution(solution, calibration.items, calibration.config)
const output = 'data/reconstruction/v3/crossfill-6-7'; mkdirSync(output, { recursive: true })
writeFileSync(`${output}/patch.json`, JSON.stringify({ inputSeeds: seeds.map(s => ({ source: s.source, path: s.path, sha256: s.sha256 })), provenance: researchCalibrationProvenance(calibration), accepted, attempts, elapsedMs: Date.now() - started, remainingIds: pending.filter(e => !placed.has(e.item.id)).map(e => e.item.id), validation }, null, 2))
writeFileSync(`${output}/result.json`, JSON.stringify({ solution, validation, config: calibration.config, complete: !solution.unpackedItems.length && validation.valid }, null, 2))
console.log(JSON.stringify({ accepted: accepted.length, totalLoaded: placed.size, totalMissing: solution.unpackedItems.length, valid: validation.valid, errors: validation.errors.slice(0, 3), remaining6and7: pending.filter(e => !placed.has(e.item.id)).length, elapsedMs: Date.now() - started }))
