// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { createPackingSolution } from '../core/solution-builder'
import { loadingRulesFor } from '../core/loading-profile'
import { validateSolution } from '../core/validation'
import { startReplayRecord } from './replay-run-record'
import type { PackingSolution } from '../types/packing'

const finish = startReplayRecord(import.meta.url), calibration = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const names: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 10: 'ten', 11: 'eleven' }
for (const [number, name] of Object.entries(names)) {
  const n = Number(number), sourcePath = `data/reconstruction/pdf-container-${name}-seed/result.json`
  const previous = JSON.parse(readFileSync(sourcePath, 'utf8')) as { complete: boolean; sourceIds: string[]; solution: PackingSolution }
  if (!previous.complete) throw new Error(`Cannot migrate incomplete container ${n}`)
  const allocation = calibration.pdfAllocation.find(c => c.containerNumber === n)!, allowed = new Set(allocation.ids)
  const items = calibration.items.filter(i => allowed.has(i.id)), originals = new Map(items.map(i => [i.id, i]))
  if (previous.sourceIds.length !== allowed.size || previous.sourceIds.some(id => !allowed.has(id))) throw new Error('Fixed allocation mismatch')
  const containers = previous.solution.containers.map(c => ({ ...structuredClone(c), id: `pdf-container-${n}`, loadingRules: loadingRulesFor(items, calibration.config), items: c.items.map(p => ({ ...p, item: originals.get(p.item.id)! })) }))
  const solution = createPackingSolution(containers, [], 'PDF-FIXED-ALLOCATION-V3-REVALIDATION', 0, 0)
  const validation = validateSolution(solution, items, calibration.config)
  solution.validation = validation
  if (!validation.valid || containers.flatMap(c => c.items).length !== items.length) throw new Error(JSON.stringify({ n, validation }))
  const result = { sourceContainerNumber: n, sourceIds: allocation.ids, complete: true, config: calibration.config, solution, validation, provenance: researchCalibrationProvenance(calibration), construction: 'Previously complete fixed-allocation coordinates, independently revalidated under explicit user-approved v3; no coordinate or original cargo field changed.', originalCoordinates: { path: sourcePath, sha256: researchFileHash(sourcePath) }, execution: finish() }
  const output = `data/reconstruction/v3/container-${n}`; mkdirSync(output, { recursive: true }); writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2))
  appendFileSync('data/reconstruction/process-journal.jsonl', `${JSON.stringify({ event: 'unchanged-layout-v3-revalidation', sourceContainerNumber: n, units: items.length, complete: true, originalCoordinates: result.originalCoordinates, provenance: result.provenance, execution: result.execution })}\n`)
  console.log(JSON.stringify({ sourceContainerNumber: n, units: items.length, complete: true, output }))
}
