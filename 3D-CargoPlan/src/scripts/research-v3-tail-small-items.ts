// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { PackingSolution } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate, compareResearchMetrics } from '../core/research-metrics'
import { analyzeStacking, updateContainer } from '../core/packing-utils'
import { placeResearchItem } from '../core/research-placement'
import { solidVolume } from '../core/solid-geometry'

// A complete incumbent is preserved after every accepted transfer; a timeout cannot
// promote a partially emptied donor or an incompletely reinserted support subtree.
const input = process.argv[2] ?? 'data/optimization/v3-last-w12-repair/best-complete.json'
const output = process.argv[3] ?? 'data/optimization/v3-tail-small-items'
const donorIndex = Number(process.argv[4] ?? 3)
const budgetMs = Number(process.argv[5] ?? 50000)
mkdirSync(output, { recursive: true })
const started = Date.now(), deadline = started + budgetMs
const calibration = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
let solution = JSON.parse(readFileSync(input, 'utf8')).solution as PackingSolution
let assessed = assessResearchCandidate(solution, calibration.items, calibration.config)
if (!assessed.metrics.eligible) throw Error('A complete and valid input is required')
const provenance = {
  ...researchCalibrationProvenance(calibration), input: { path: input, sha256: researchFileHash(input) },
  script: { path: 'src/scripts/research-v3-tail-small-items.ts', sha256: researchFileHash('src/scripts/research-v3-tail-small-items.ts') },
  engineFiles: ['src/core/research-placement.ts', 'src/core/packing-utils.ts', 'src/core/validation.ts', 'src/core/solid-geometry.ts'].map(path => ({ path, sha256: researchFileHash(path) })),
  donorIndex, budgetMs, startedAt: new Date(started).toISOString(),
}
writeFileSync(`${output}/executed-script.ts.txt`, readFileSync('src/scripts/research-v3-tail-small-items.ts'))
writeFileSync(`${output}/source-snapshot.json`, JSON.stringify({ provenance, solution, metrics: assessed.metrics }))
const moves: unknown[] = [], attempts: unknown[] = []
const save = (name: string) => writeFileSync(`${output}/${name}.json`, JSON.stringify({ provenance, config: calibration.config, solution, metrics: assessed.metrics, validation: assessed.validation, moves, elapsedMs: Date.now() - started }, null, 2))
save('initial-complete')
for (let pass = 0; pass < 3 && Date.now() < deadline; pass++) {
  const donor = solution.containers[donorIndex]
  const candidates = [...donor.items].filter(p => p.item.rawData._sourceSheet !== '玻璃架' && !(p.item.rawData._sourceSheet === '门窗' && [16, 23, 25].includes(Number(p.item.rawData._sourceRow))))
    .sort((a, b) => pass === 0 ? b.position.z - a.position.z || solidVolume(b.item) - solidVolume(a.item) : solidVolume(b.item) - solidVolume(a.item) || b.position.z - a.position.z)
  let acceptedCount = 0
  for (const old of candidates) {
    if (Date.now() >= deadline) break
    const current = solution.containers[donorIndex], index = current.items.findIndex(p => p.item.id === old.item.id)
    if (index < 0) continue
    const stacking = analyzeStacking(current.items, current.loadingRules)
    if (stacking.supports.some(support => support.some(s => s.index === index))) continue
    const candidate = structuredClone(solution), source = candidate.containers[donorIndex]
    source.items.splice(index, 1); updateContainer(source)
    // Leave source1 untouched: another branch is consolidating it as its tail.
    const targets = candidate.containers.map((container, i) => ({ container, i })).filter(({ i }) => i !== donorIndex && i !== 0)
      .sort((a, b) => b.container.volumeUtilization - a.container.volumeUtilization)
    let accepted = false
    for (const { container: target } of targets) {
      const placement = placeResearchItem(old.item, target, pass + 3, Math.min(deadline, Date.now() + 100))
      if (!placement) continue
      target.items.push(placement); updateContainer(target)
      const result = assessResearchCandidate(candidate, calibration.items, calibration.config)
      if (result.metrics.eligible) {
        const record = { id: old.item.id, from: source.id, to: target.id, position: placement.position, orientation: placement.orientation, rotation: placement.rotation, donorSolidM3: result.metrics.containers.find(c => c.sourceIndex === donorIndex)!.solidVolumeM3, tailSolidM3: result.metrics.tailSolidVolumeMm3 / 1e9, objectiveImproved: compareResearchMetrics(result.metrics, assessed.metrics) < 0 }
        solution = candidate; assessed = result; moves.push(record); acceptedCount++; accepted = true
        save('latest-complete')
        if (record.objectiveImproved) save('best-complete')
        appendFileSync(`${output}/ledger.jsonl`, JSON.stringify(record) + '\n')
        console.log(JSON.stringify(record)); break
      }
      attempts.push({ id: old.item.id, target: target.id, errors: result.validation.errors })
      target.items.pop(); updateContainer(target)
    }
    if (!accepted) attempts.push({ id: old.item.id, accepted: false, pass })
  }
  if (!acceptedCount) break
}
writeFileSync(`${output}/summary.json`, JSON.stringify({ provenance, metrics: assessed.metrics, moves, attempts, elapsedMs: Date.now() - started }, null, 2))
console.log(JSON.stringify({ event: 'complete', moved: moves.length, tailM3: assessed.metrics.tailSolidVolumeMm3 / 1e9, front10Min: assessed.metrics.front10MinimumSolidUtilization, elapsedMs: Date.now() - started }))
