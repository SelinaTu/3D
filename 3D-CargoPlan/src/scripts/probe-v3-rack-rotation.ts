// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { analyzeStacking, calculateActualDimensions, updateContainer } from '../core/packing-utils'
import { nestedInside, pairGeometryErrors } from '../core/solid-geometry'
import { assessResearchCandidate } from '../core/research-metrics'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { createPackingSolution } from '../core/solution-builder'
import { startReplayRecord } from './replay-run-record'
import type { PackingSolution } from '../types/packing'

const finish = startReplayRecord(import.meta.url), cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json'), input = 'data/optimization/v3-window-cpsat/round-4/result.json', source = JSON.parse(readFileSync(input, 'utf8')) as { solution: PackingSolution }, containers = structuredClone(source.solution.containers), c = containers[8], output = 'data/optimization/v3-rack-rotation'
mkdirSync(output, { recursive: true })
const rackIndex = c.items.findIndex(p => p.item.rawData._sourceSheet === '玻璃架' && p.item.rawData._sourceRow === 20), rack = c.items[rackIndex]
if (!rack || rack.actualDimensions.length !== 1841 || rack.actualDimensions.width !== 1284) throw new Error('Expected original ninth-bin 1841 × 1284 rack')
const originalStack = analyzeStacking(c.items, c.loadingRules), rotated = new Set([rack.item.id, ...[...originalStack.descendants[rackIndex]].map(i => c.items[i].item.id)]), moved = new Set(rotated), moves: unknown[] = []
const x0 = rack.position.x, y0 = rack.position.y, oldLength = rack.actualDimensions.length
for (const p of c.items.filter(p => rotated.has(p.item.id))) {
  const before = structuredClone(p), rotation = (p.rotation + 90) % 180
  p.position = { x: x0 + before.position.y - y0, y: y0 + oldLength - (before.position.x - x0) - before.actualDimensions.length, z: before.position.z }
  p.rotation = rotation; p.actualDimensions = calculateActualDimensions(p.item.dimensions, p.orientation, rotation, p.item.orientationVerticalAxes)
  moves.push({ id: p.item.id, reason: 'whole-rack-and-supported-cargo horizontal quarter-turn', before: { position: before.position, rotation: before.rotation, dimensions: before.actualDimensions }, after: { position: p.position, rotation: p.rotation, dimensions: p.actualDimensions } })
}
for (const p of c.items.filter(p => p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === 25)) { const before = { ...p.position }; p.position.y = 1846; moved.add(p.item.id); moves.push({ id: p.item.id, before, after: p.position, reason: 'retain all long profiles behind the rotated rack' }) }
const rejected: unknown[] = [], removed = new Set<string>()
for (const p of c.items.filter(p => moved.has(p.item.id))) for (const q of c.items.filter(q => !moved.has(q.item.id))) {
  const errors = pairGeometryErrors(p, q, c)
  if (errors.length) { rejected.push({ moved: p.item.id, blocker: q.item.id, errors }); removed.add(q.item.id) }
}
if (c.items.some(p => removed.has(p.item.id) && (p.item.rawData._sourceSheet === '玻璃架' || p.item.weight > 600 || p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === 23))) throw new Error('Rotation would require moving another fixed structural component')
let expanding = true
while (expanding) { expanding = false; for (const [i, p] of c.items.entries()) if (!removed.has(p.item.id) && (originalStack.supports[i].some(s => removed.has(c.items[s.index].item.id)) || c.items.some(q => removed.has(q.item.id) && nestedInside(p, q)))) { removed.add(p.item.id); expanding = true } }
c.items = c.items.filter(p => !removed.has(p.item.id)); containers.forEach(updateContainer)
const used = new Set(containers.flatMap(c => c.items.map(p => p.item.id))), assessed = assessResearchCandidate(createPackingSolution(containers, cal.items.filter(i => !used.has(i.id)), 'V3-NINTH-RACK-ROTATION-STRUCTURAL-SEED', 0, 0), cal.items, cal.config)
const record = { provenance: { ...researchCalibrationProvenance(cal), input, inputSha256: researchFileHash(input) }, config: cal.config, ...assessed, moves, rejected, removedIds: [...removed], execution: finish() }
writeFileSync(`${output}/probe.json`, JSON.stringify(record, null, 2))
if (assessed.validation.valid) writeFileSync(`${output}/seed.json`, JSON.stringify(record, null, 2))
console.log(JSON.stringify({ output, rotated: rotated.size, removed: removed.size, loaded: used.size, missing: assessed.solution.unpackedItems.length, valid: assessed.validation.valid, errors: assessed.validation.errors.slice(0, 8), removedIds: [...removed] }))
