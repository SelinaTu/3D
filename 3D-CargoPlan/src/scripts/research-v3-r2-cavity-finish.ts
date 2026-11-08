// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { PackingSolution } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate, compareResearchMetrics } from '../core/research-metrics'
import { calculateActualDimensions, canPlaceAt, updateContainer } from '../core/packing-utils'

const input = 'data/optimization/v3-r2-delivery/best-complete.json', output = 'data/optimization/v3-r2-cavity-finish'
mkdirSync(output, { recursive: true })
const cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json'), started = Date.now()
let solution = JSON.parse(readFileSync(input, 'utf8')).solution as PackingSolution
let assessment = assessResearchCandidate(solution, cal.items, cal.config)
if (!assessment.metrics.eligible) throw Error('Full valid baseline required')
const provenance = { ...researchCalibrationProvenance(cal), input: { path: input, sha256: researchFileHash(input) }, script: { path: 'src/scripts/research-v3-r2-cavity-finish.ts', sha256: researchFileHash('src/scripts/research-v3-r2-cavity-finish.ts') }, scope: 'Two explicit fourth-layer W05 anchors inside the confirmed W02 aperture; original width axis remains vertical; all identities and full rules checked after every move.' }
writeFileSync(`${output}/input-snapshot.json`, readFileSync(input))
const attempts: unknown[] = [], moves: unknown[] = []
for (const x of [920, 1455]) {
  for (const donor of assessment.metrics.containers.slice(0, 10).filter(c => c.sourceIndex !== 0).sort((a, b) => b.solidVolumeMm3 - a.solidVolumeMm3)) {
    let accepted = false
    for (const old of [...solution.containers[donor.sourceIndex].items].filter(p => p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === 8).sort((a, b) => b.position.z - a.position.z)) {
      const candidate = structuredClone(solution), source = candidate.containers[donor.sourceIndex], target = candidate.containers[0]
      source.items = source.items.filter(p => p.item.id !== old.item.id); updateContainer(source)
      const position = { x, y: 1839, z: 1790 }
      if (!canPlaceAt(old.item, position, 'lying', 0, target)) { attempts.push({ id: old.item.id, position, rejected: 'target pose/support/geometry' }); continue }
      target.items.push({ item: old.item, position, orientation: 'lying', rotation: 0, actualDimensions: calculateActualDimensions(old.item.dimensions, 'lying', 0, old.item.orientationVerticalAxes) }); updateContainer(target)
      const next = assessResearchCandidate(candidate, cal.items, cal.config), improved = next.metrics.eligible && compareResearchMetrics(next.metrics, assessment.metrics) < 0
      const record = { id: old.item.id, from: source.id, to: target.id, position, orientation: 'lying', rotation: 0, accepted: improved, errors: next.validation.errors.slice(0, 5) }; attempts.push(record)
      if (!improved) continue
      solution = candidate; assessment = next; moves.push(record); accepted = true; break
    }
    if (accepted) break
  }
}
const result = { provenance, config: cal.config, ...assessment, moves, attempts, elapsedMs: Date.now() - started }
writeFileSync(`${output}/best-complete.json`, JSON.stringify(result, null, 2))
writeFileSync(`${output}/summary.json`, JSON.stringify({ provenance, metrics: assessment.metrics, moves, attempts, elapsedMs: Date.now() - started }, null, 2))
console.log(JSON.stringify({ moved: moves.length, valid: assessment.metrics.eligible, tailM3: assessment.metrics.tailSolidVolumeMm3 / 1e9, front10Minimum: assessment.metrics.front10MinimumSolidUtilization }))
