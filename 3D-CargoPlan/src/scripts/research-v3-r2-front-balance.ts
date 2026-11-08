// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PackingSolution } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate, compareResearchMetrics, researchHash } from '../core/research-metrics'
import { updateContainer } from '../core/packing-utils'
import { placeResearchItem } from '../core/research-placement'
import { isGlassRack, solidVolume } from '../core/solid-geometry'

const input = process.argv[2] ?? 'data/optimization/v3-tail-independent/frozen-complete.json'
const output = process.argv[3] ?? 'data/optimization/v3-r2-front-balance'
const budgetMs = Number(process.argv[4] ?? 50000)
const start = Date.now(), deadline = start + budgetMs
mkdirSync(output, { recursive: true })
const cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
let solution = JSON.parse(readFileSync(input, 'utf8')).solution as PackingSolution
let assessed = assessResearchCandidate(solution, cal.items, cal.config)
if (!assessed.metrics.eligible || assessed.metrics.totalContainers !== 11) throw Error('A complete eleven-container baseline is required')
const baseline = assessed.metrics
const paths = ['src/scripts/research-v3-r2-front-balance.ts', 'src/core/research-placement.ts', 'src/core/research-metrics.ts', 'src/core/packing-utils.ts', 'src/core/solid-geometry.ts', 'src/core/validation.ts']
const engineFiles = paths.map(path => {
  const snapshotPath = `${output}/engine-snapshot/${path}`; mkdirSync(dirname(snapshotPath), { recursive: true })
  writeFileSync(snapshotPath, readFileSync(path)); return { path, snapshotPath, sha256: researchFileHash(snapshotPath) }
})
const provenance = { ...researchCalibrationProvenance(cal), input: { path: input, sha256: researchFileHash(input) }, engineFiles, engineSha256: researchHash(engineFiles), budgetMs, startedAt: new Date(start).toISOString(), seed: null, mode: 'deterministic-complete-only-front-ten-minimum-balancing' }
writeFileSync(`${output}/input-snapshot.json`, readFileSync(input))
const moves: unknown[] = []
let trials = 0, rejected = 0
const atomic = (path: string, text: string) => { writeFileSync(`${path}.tmp`, text); renameSync(`${path}.tmp`, path) }
while (Date.now() < deadline) {
  const front = assessed.metrics.containers.slice(0, 10), minimum = front.at(-1)!, targetIndex = minimum.sourceIndex
  const sources = front.filter(c => c.sourceIndex !== targetIndex).sort((a, b) => b.solidVolumeMm3 - a.solidVolumeMm3)
  let accepted = false
  for (const donorMetric of sources) {
    const donorItems = [...solution.containers[donorMetric.sourceIndex].items]
      .filter(p => !isGlassRack(p.item) && !(p.item.rawData._sourceSheet === '门窗' && [9, 16, 23, 25].includes(Number(p.item.rawData._sourceRow))))
      .sort((a, b) => Number(b.item.rawData._sourceSheet === '门窗' && b.item.rawData._sourceRow === 8) - Number(a.item.rawData._sourceSheet === '门窗' && a.item.rawData._sourceRow === 8) || b.position.z - a.position.z)
    for (const old of donorItems) {
      if (Date.now() >= deadline) break
      // A donor must remain strictly above the old bottleneck after the transfer.
      if (donorMetric.solidVolumeMm3 - solidVolume(old.item) <= minimum.solidVolumeMm3 + 1) continue
      for (const mode of [3, 4, 5]) {
        if (Date.now() >= deadline) break
        const candidate = structuredClone(solution), source = candidate.containers[donorMetric.sourceIndex], target = candidate.containers[targetIndex]
        source.items = source.items.filter(p => p.item.id !== old.item.id); updateContainer(source)
        const p = placeResearchItem(old.item, target, mode, Math.min(deadline, Date.now() + 100)); trials++
        if (!p) continue
        target.items.push(p); updateContainer(target)
        const next = assessResearchCandidate(candidate, cal.items, cal.config)
        const valid = next.metrics.eligible && compareResearchMetrics(next.metrics, assessed.metrics) < 0 && next.metrics.tailSolidVolumeMm3 <= baseline.tailSolidVolumeMm3
        const record = { trial: trials, id: old.item.id, from: source.id, to: target.id, position: p.position, orientation: p.orientation, rotation: p.rotation, accepted: valid, errors: next.validation.errors.slice(0, 4), front10Minimum: next.metrics.front10MinimumSolidUtilization, tailM3: next.metrics.tailSolidVolumeMm3 / 1e9, elapsedMs: Date.now() - start }
        appendFileSync(`${output}/ledger.jsonl`, JSON.stringify(record) + '\n')
        if (!valid) { rejected++; continue }
        solution = candidate; assessed = next; moves.push(record); accepted = true
        const result = { provenance, config: cal.config, ...assessed, moves, record: { trials, accepted: moves.length, rejected, elapsedMs: Date.now() - start, globalOptimalityProven: false } }
        atomic(`${output}/best-complete.json`, JSON.stringify(result, null, 2))
        console.log(JSON.stringify(record)); break
      }
      if (accepted) break
    }
    if (accepted || Date.now() >= deadline) break
  }
  if (!accepted) break
}
writeFileSync(`${output}/summary.json`, JSON.stringify({ provenance, baseline, best: assessed.metrics, trials, accepted: moves.length, rejected, elapsedMs: Date.now() - start }, null, 2))
console.log(JSON.stringify({ finished: true, accepted: moves.length, trials, front10Minimum: assessed.metrics.front10MinimumSolidUtilization, tailM3: assessed.metrics.tailSolidVolumeMm3 / 1e9, elapsedMs: Date.now() - start }))
