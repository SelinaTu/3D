// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { updateContainer } from '../core/packing-utils'
import { assessResearchCandidate, researchHash } from '../core/research-metrics'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { createPackingSolution } from '../core/solution-builder'
import { startReplayRecord } from './replay-run-record'
import type { PackingSolution, PlacedItem } from '../types/packing'

const finish = startReplayRecord(import.meta.url), [ancestorPath, basePath, patchPath, outputPath] = process.argv.slice(2)
if (!outputPath) throw new Error('Usage: ancestor.json base.json patch.json output.json')
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as { solution: PackingSolution }
const ancestor = read(ancestorPath), base = read(basePath), patch = read(patchPath), cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const signature = (p: PlacedItem, bin: number) => researchHash({ bin, position: p.position, orientation: p.orientation, rotation: p.rotation, dimensions: p.actualDimensions })
const mapping = (s: PackingSolution) => new Map(s.containers.flatMap((c, bin) => c.items.map(p => [p.item.id, signature(p, bin)] as const)))
const old = mapping(ancestor.solution), newer = mapping(patch.solution), current = mapping(base.solution)
const changed = new Set([...old.keys(), ...newer.keys()].filter(id => old.get(id) !== newer.get(id)))
const conflicts = [...changed].filter(id => current.get(id) !== old.get(id) && current.get(id) !== newer.get(id))
if (conflicts.length) throw new Error(`Three-way conflicts: ${conflicts.join(', ')}`)
const containers = structuredClone(base.solution.containers)
containers.forEach(c => { c.items = c.items.filter(p => !changed.has(p.item.id)) })
patch.solution.containers.forEach((c, bin) => containers[bin].items.push(...c.items.filter(p => changed.has(p.item.id))))
containers.forEach(updateContainer)
const ids = new Set(containers.flatMap(c => c.items.map(p => p.item.id))), solution = createPackingSolution(containers, cal.items.filter(i => !ids.has(i.id)), 'V3-VALIDATED-THREE-WAY-MERGE', 0, 0), assessed = assessResearchCandidate(solution, cal.items, cal.config)
if (!assessed.validation.valid) throw new Error(JSON.stringify(assessed.validation))
mkdirSync(path.dirname(outputPath), { recursive: true })
const provenance = { ...researchCalibrationProvenance(cal), mergeInputs: [ancestorPath, basePath, patchPath].map(file => ({ path: file, sha256: researchFileHash(file) })) }
writeFileSync(outputPath, JSON.stringify({ provenance, config: cal.config, ...assessed, mergeRecord: { changedIds: [...changed] }, execution: finish() }, null, 2))
console.log(JSON.stringify({ outputPath, changed: changed.size, loaded: assessed.metrics.placedItems, missing: assessed.metrics.unpackedItems, valid: assessed.validation.valid }))
