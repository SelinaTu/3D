// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PackingSolution, PlacedItem } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate, compareResearchMetrics, researchHash } from '../core/research-metrics'
import { canPlaceAt, updateContainer } from '../core/packing-utils'
import { createPackingSolution } from '../core/solution-builder'

const [ancestorPath, basePath, patchPath, outputPath] = process.argv.slice(2)
if (!outputPath) throw Error('Usage: ancestor base patch output')
const started = Date.now(), cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')).solution as PackingSolution
const ancestor = read(ancestorPath), base = read(basePath), patch = read(patchPath)
const signature = (p: PlacedItem, bin: number) => researchHash({ bin, p: p.position, orientation: p.orientation, rotation: p.rotation, dimensions: p.actualDimensions })
const map = (s: PackingSolution) => new Map(s.containers.flatMap((c, i) => c.items.map(p => [p.item.id, { signature: signature(p, i), index: i }] as const)))
const original = map(ancestor), current = map(base), changed = map(patch)
const edited = new Set([...original.keys()].filter(id => original.get(id)?.signature !== changed.get(id)?.signature))
const conflicts = [...edited].filter(id => current.get(id)?.signature !== original.get(id)?.signature && current.get(id)?.signature !== changed.get(id)?.signature)
if (conflicts.length) throw Error(`Independent edits conflict: ${conflicts.join(', ')}`)
const containers = structuredClone(base.containers)
containers.forEach(c => { c.items = c.items.filter(p => !edited.has(p.item.id)); updateContainer(c) })
patch.containers.forEach((c, i) => { containers[i].items.push(...structuredClone(c.items.filter(p => edited.has(p.item.id)))); updateContainer(containers[i]) })
const make = () => createPackingSolution(containers, [], 'V3-R2-INDEPENDENT-MERGE-WITH-RECORDED-FLOOR-REPAIR', 0, Date.now() - started)
let assessed = assessResearchCandidate(make(), cal.items, cal.config)
const repairs: unknown[] = [], beforeErrors = assessed.validation.errors
if (!assessed.metrics.eligible) {
  // Independent branches may use the same newly empty tail end strip. Repair
  // only incoming floor items, preserving their source-approved pose and size.
  const tailIndex = assessResearchCandidate(base, cal.items, cal.config).metrics.containers.at(-1)!.sourceIndex
  const c = containers[tailIndex]
  const incoming = c.items.filter(p => edited.has(p.item.id) && original.get(p.item.id)?.index !== tailIndex && p.position.z === 0)
  for (const p of incoming) {
    c.items = c.items.filter(q => q.item.id !== p.item.id); updateContainer(c)
    let replacement: PlacedItem | null = null
    for (const x of [9640, 9755, 9870, 9985]) for (const y of [0, 115, 2250 - p.actualDimensions.width]) {
      if (replacement) break
      const position = { x, y, z: 0 }
      if (canPlaceAt(p.item, position, p.orientation, p.rotation, c)) replacement = { ...p, position }
    }
    c.items.push(replacement ?? p); updateContainer(c)
    if (replacement) repairs.push({ id: p.item.id, from: p.position, to: replacement.position, orientation: p.orientation, rotation: p.rotation })
  }
  assessed = assessResearchCandidate(make(), cal.items, cal.config)
}
const reference = assessResearchCandidate(base, cal.items, cal.config)
const accepted = assessed.metrics.eligible && compareResearchMetrics(assessed.metrics, reference.metrics) < 0
const provenance = { ...researchCalibrationProvenance(cal), mergeInputs: [ancestorPath, basePath, patchPath].map(path => ({ path, sha256: researchFileHash(path) })), script: { path: 'src/scripts/research-v3-r2-integrate.ts', sha256: researchFileHash('src/scripts/research-v3-r2-integrate.ts') } }
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify({ provenance, config: cal.config, ...assessed, mergeRecord: { editedIds: [...edited], beforeErrors, repairs, accepted }, elapsedMs: Date.now() - started }, null, 2))
console.log(JSON.stringify({ outputPath, accepted, complete: assessed.metrics.eligible, tailM3: assessed.metrics.tailSolidVolumeMm3 / 1e9, front10Minimum: assessed.metrics.front10MinimumSolidUtilization, repairs, errors: assessed.validation.errors.slice(0, 5) }))
if (!accepted) process.exitCode = 1
