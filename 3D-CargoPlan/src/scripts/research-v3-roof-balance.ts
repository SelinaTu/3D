// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { analyzeStacking, canPlaceAt, calculateActualDimensions, updateContainer } from '../core/packing-utils'
import { assessResearchCandidate } from '../core/research-metrics'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { createPackingSolution } from '../core/solution-builder'
import { placeResearchItem } from '../core/research-placement'
import { startReplayRecord } from './replay-run-record'
import type { PackingSolution } from '../types/packing'

const finish = startReplayRecord(import.meta.url), cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const input = process.argv[2] ?? 'data/optimization/v3-cpsat-floor/round-2/result.json', source = JSON.parse(readFileSync(input, 'utf8')) as { solution: PackingSolution }
const containers = structuredClone(source.solution.containers), c = containers[5], attempts: unknown[] = [], output = 'data/optimization/v3-roof-balance'
const loads = () => { const a = analyzeStacking(c.items, c.loadingRules); return c.items.flatMap((p, i) => p.item.rawData._sourceSheet === '玻璃架' ? [{ id: p.item.id, load: a.topLoads[i] }] : []) }
attempts.push({ event: 'before', loads: loads() })
// Transfer an existing four-bar pile towards the spare capacity of the next rack.
const pileIds = [31, 33, 34, 35].map(u => `门窗:W08:r10:u${u}`)
for (const id of pileIds) { const p = c.items.find(p => p.item.id === id); if (!p || p.position.x !== 5400 || p.position.y !== 0) throw new Error(`Unexpected roof pile: ${id}`); p.position.x = 8073 }
updateContainer(c)
const check = () => { const ids = new Set(containers.flatMap(c => c.items.map(p => p.item.id))); const solution = createPackingSolution(containers, cal.items.filter(i => !ids.has(i.id)), 'V3-RACK-ROOF-LOAD-BALANCE', 0, 0); return assessResearchCandidate(solution, cal.items, cal.config) }
let assessed = check()
attempts.push({ event: 'pile-transferred', loads: loads(), validation: assessed.validation })
if (!assessed.validation.valid) throw new Error(JSON.stringify(assessed.validation))
for (const [units, x, y] of [[[9, 10, 12, 14, 16], 5907, 1188], [[29, 30, 11, 13, 15], 6990, 650]] as const) for (const [j, u] of units.entries()) {
  const p = c.items.find(p => p.item.id === `门窗:W08:r10:u${u}`)!
  p.position = { x, y, z: 1098 + 225 * j }; p.orientation = 'lying'; p.rotation = 0; p.actualDimensions = calculateActualDimensions(p.item.dimensions, 'lying', 0, p.item.orientationVerticalAxes)
}
updateContainer(c); assessed = check()
attempts.push({ event: 'mixed-roof-piles-consolidated', loads: loads(), validation: assessed.validation })
if (!assessed.validation.valid) throw new Error(JSON.stringify(assessed.validation))
for (const [x, y, z, orientation] of [[5907, 1188, 2223, 'lying'], [6990, 650, 2223, 'lying'], [6990, 955, 1403, 'flat'], [6990, 955, 1708, 'flat'], [6990, 955, 2013, 'flat']] as const) {
  const item = assessed.solution.unpackedItems.find(i => i.rawData._sourceSheet === '门窗' && i.rawData._sourceRow === 10)
  if (!item) break
  const position = { x, y, z }, accepted = canPlaceAt(item, position, orientation, 0, c)
  attempts.push({ event: 'exact-roof-insertion', id: item.id, position, orientation, accepted })
  if (accepted) { c.items.push({ item, position, orientation, rotation: 0, actualDimensions: calculateActualDimensions(item.dimensions, orientation, 0, item.orientationVerticalAxes) }); updateContainer(c); assessed = check() }
}
const deadline = Date.now() + 12000
for (const item of [...assessed.solution.unpackedItems]) for (const bi of [5, 10, 0, 3, 4, 6, 7, 8, 9, 1, 2]) {
  if (Date.now() >= deadline) break
  const p = placeResearchItem(item, containers[bi], 3, Math.min(deadline, Date.now() + 130))
  if (p) { containers[bi].items.push(p); updateContainer(containers[bi]); attempts.push({ event: 'residual-insertion', id: item.id, bin: bi + 1, position: p.position, orientation: p.orientation, rotation: p.rotation }); break }
}
assessed = check()
attempts.push({ event: 'after', loads: loads() })
if (!assessed.validation.valid) throw new Error(JSON.stringify(assessed.validation))
mkdirSync(output, { recursive: true })
writeFileSync(`${output}/result.json`, JSON.stringify({ provenance: { ...researchCalibrationProvenance(cal), input, inputSha256: researchFileHash(input) }, config: cal.config, ...assessed, attempts, execution: finish() }, null, 2))
console.log(JSON.stringify({ output, loaded: assessed.metrics.placedItems, missing: assessed.metrics.unpackedItems, valid: assessed.validation.valid, loads: loads() }))
