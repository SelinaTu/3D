// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { canPlaceAt, calculateActualDimensions, updateContainer } from '../core/packing-utils'
import { assessResearchCandidate, researchHash } from '../core/research-metrics'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { createPackingSolution } from '../core/solution-builder'
import { startReplayRecord } from './replay-run-record'
import type { PackingSolution, PlacedItem } from '../types/packing'

const finish = startReplayRecord(import.meta.url), calibration = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const sourcePath = 'data/optimization/v3-macro-repack/best-partial.json', source = JSON.parse(readFileSync(sourcePath, 'utf8')) as { solution: PackingSolution }
const containers = structuredClone(source.solution.containers), c = containers[5], profiles = source.solution.unpackedItems.filter(i => i.rawData._sourceSheet === '门窗' && i.rawData._sourceRow === 25), attempts: unknown[] = []
let layer = 0
for (const item of profiles) {
  const position = { x: 4995, y: 230, z: 1098 + 185 * layer }, accepted = canPlaceAt(item, position, 'lying', 0, c)
  attempts.push({ id: item.id, position, orientation: 'lying', accepted })
  if (accepted) { c.items.push({ item, position, orientation: 'lying', rotation: 0, actualDimensions: calculateActualDimensions(item.dimensions, 'lying', 0, item.orientationVerticalAxes) }); updateContainer(c); layer++ }
}
const allIds = new Set(containers.flatMap(c => c.items.map(p => p.item.id))), solution = createPackingSolution(containers, calibration.items.filter(i => !allIds.has(i.id)), 'V3-RESTORE-EXACT-PAIRED-RACK-PROFILES', 0, 0)
const assessed = assessResearchCandidate(solution, calibration.items, calibration.config)
if (!assessed.validation.valid) throw new Error(JSON.stringify(assessed.validation))
const output = 'data/optimization/v3-profile-restore'; mkdirSync(output, { recursive: true })
const provenance = { ...researchCalibrationProvenance(calibration), sourcePath, sourceSha256: researchFileHash(sourcePath) }
writeFileSync(`${output}/result.json`, JSON.stringify({ provenance, config: calibration.config, solution, metrics: assessed.metrics, validation: assessed.validation, attempts, execution: finish() }, null, 2))
console.log(JSON.stringify({ output, placed: assessed.metrics.placedItems, missing: assessed.metrics.unpackedItems, valid: assessed.validation.valid }))

// Merge a separately validated roof exchange relative to its unchanged ancestor.
const ancestorPath = 'data/optimization/v3-repair-11/best-partial.json', roofPath = 'data/optimization/v3-roof-exchange/best-partial.json'
const ancestor = JSON.parse(readFileSync(ancestorPath, 'utf8')) as { solution: PackingSolution }, roof = JSON.parse(readFileSync(roofPath, 'utf8')) as { solution: PackingSolution }
const signature = (p: PlacedItem, bin: number) => researchHash({ bin, position: p.position, orientation: p.orientation, rotation: p.rotation })
const old = new Map(ancestor.solution.containers.flatMap((c, bin) => c.items.map(p => [p.item.id, signature(p, bin)] as const)))
const newer = new Map(roof.solution.containers.flatMap((c, bin) => c.items.map(p => [p.item.id, signature(p, bin)] as const)))
const changed = new Set([...old.keys(), ...newer.keys()].filter(id => old.get(id) !== newer.get(id)))
const merged = structuredClone(containers)
merged.forEach(c => { c.items = c.items.filter(p => !changed.has(p.item.id)) })
roof.solution.containers.forEach((c, bin) => merged[bin].items.push(...c.items.filter(p => changed.has(p.item.id))))
merged.forEach(updateContainer)
const ids = new Set(merged.flatMap(c => c.items.map(p => p.item.id))), mergedSolution = createPackingSolution(merged, calibration.items.filter(i => !ids.has(i.id)), 'V3-PROFILE-AND-ROOF-EXCHANGE-MERGE', 0, 0), checked = assessResearchCandidate(mergedSolution, calibration.items, calibration.config)
const mergeRecord = { ancestorPath, ancestorSha256: researchFileHash(ancestorPath), roofPath, roofSha256: researchFileHash(roofPath), changedIds: [...changed], validation: checked.validation }
writeFileSync(`${output}/roof-merge.json`, JSON.stringify({ provenance, config: calibration.config, solution: mergedSolution, metrics: checked.metrics, validation: checked.validation, mergeRecord, execution: finish() }, null, 2))
if (checked.validation.valid && checked.metrics.placedItems > assessed.metrics.placedItems) writeFileSync(`${output}/best-partial.json`, JSON.stringify({ provenance, config: calibration.config, solution: mergedSolution, metrics: checked.metrics, validation: checked.validation, mergeRecord, execution: finish() }, null, 2))
console.log(JSON.stringify({ event: 'roof-merge', loaded: checked.metrics.placedItems, missing: checked.metrics.unpackedItems, valid: checked.validation.valid, errors: checked.validation.errors.slice(0, 5) }))
