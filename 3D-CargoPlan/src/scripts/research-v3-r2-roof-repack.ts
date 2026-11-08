// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { PackingSolution } from '../types/packing'
import { calculateActualDimensions, updateContainer } from '../core/packing-utils'
import { placeResearchItem } from '../core/research-placement'
import { assessResearchCandidate, compareResearchMetrics } from '../core/research-metrics'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'

const input = 'data/optimization/v3-tail-independent/frozen-complete.json'
const script = 'src/scripts/research-v3-r2-roof-repack.ts'
const output = 'data/optimization/v3-r2-tail-transfer/manual-swap'
const started = Date.now(), deadline = started + 10000
mkdirSync(output, { recursive: true })
const inputBytes = readFileSync(input)
const solution = JSON.parse(inputBytes.toString('utf8')).solution as PackingSolution
const calibration = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const baseline = assessResearchCandidate(solution, calibration.items, calibration.config)
if (!baseline.metrics.eligible) throw Error('Complete and valid baseline required')
const provenance = {
  ...researchCalibrationProvenance(calibration),
  input: { path: input, sha256: researchFileHash(input), snapshotPath: `${output}/input-snapshot.json` },
  script: { path: script, sha256: researchFileHash(script), snapshotPath: `${output}/executed-script.ts.txt` },
  engineFiles: ['src/core/research-placement.ts', 'src/core/packing-utils.ts', 'src/core/validation.ts', 'src/core/solid-geometry.ts', 'src/core/research-metrics.ts'].map(path => ({ path, sha256: researchFileHash(path) })),
  seed: 20261019, budgetMs: 10000,
  scope: 'Repack sourceIndex3 four lying W04r6 into a seven-flat pile with three tail W04r6; move its adjacent W04r7 onto its own flat pile; send W01r22u4 to the tail. Only accept a complete, independently valid objective improvement.',
}
writeFileSync(`${output}/input-snapshot.json`, inputBytes)
writeFileSync(`${output}/executed-script.ts.txt`, readFileSync(script))
const recipient = solution.containers[3], tail = solution.containers[2]
const existing = recipient.items.filter(p => p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === 6 && p.position.z === 1308)
const incoming = tail.items.filter(p => p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === 6)
const outgoing = recipient.items.find(p => p.item.id === '门窗:W01:r22:u4')
const adjacent = recipient.items.find(p => p.item.id === '门窗:W04(2F):r7:u31')
if (existing.length !== 4 || incoming.length !== 3 || !outgoing || !adjacent) throw Error('Expected immutable source layout not found')
Object.assign(adjacent, { orientation: 'flat', rotation: 0, position: { x: 9640, y: 0, z: 2308 }, actualDimensions: calculateActualDimensions(adjacent.item.dimensions, 'flat', 0, adjacent.item.orientationVerticalAxes) })
const removeFromRecipient = new Set([...existing.map(p => p.item.id), outgoing.item.id])
const removeFromTail = new Set(incoming.map(p => p.item.id))
recipient.items = recipient.items.filter(p => !removeFromRecipient.has(p.item.id))
tail.items = tail.items.filter(p => !removeFromTail.has(p.item.id))
for (const [i, placed] of [...existing, ...incoming].entries()) recipient.items.push({
  ...placed, orientation: 'flat', rotation: 0,
  position: { x: 9640, y: 1035, z: 1308 + 125 * i },
  actualDimensions: calculateActualDimensions(placed.item.dimensions, 'flat', 0, placed.item.orientationVerticalAxes),
})
updateContainer(recipient); updateContainer(tail)
let accepted = false
for (const mode of [1, 3, 4, 0, 2, 5]) {
  if (Date.now() >= deadline) break
  const placement = placeResearchItem(outgoing.item, tail, mode, Math.min(deadline, Date.now() + 1000))
  if (!placement) {
    appendFileSync(`${output}/ledger.jsonl`, JSON.stringify({ executedScriptSha256: provenance.script.sha256, mode, reason: 'outgoing item has no placement', elapsedMs: Date.now() - started }) + '\n')
    continue
  }
  tail.items.push(placement); updateContainer(tail)
  const assessment = assessResearchCandidate(solution, calibration.items, calibration.config)
  const improved = assessment.metrics.eligible && compareResearchMetrics(assessment.metrics, baseline.metrics) < 0 && (assessment.metrics.front10MinimumSolidUtilization ?? -Infinity) + 1e-12 >= (baseline.metrics.front10MinimumSolidUtilization ?? -Infinity)
  const record = { executedScriptSha256: provenance.script.sha256, mode, incoming: [...removeFromTail], outgoing: outgoing.item.id, placement, eligible: assessment.metrics.eligible, improved, errors: assessment.validation.errors, elapsedMs: Date.now() - started }
  appendFileSync(`${output}/ledger.jsonl`, JSON.stringify(record) + '\n')
  if (improved) {
    const result = { provenance, config: calibration.config, ...assessment, record, baselineMetrics: baseline.metrics, globalOptimalityProven: false }
    writeFileSync(`${output}/best-complete.json`, JSON.stringify(result, null, 2))
    console.log(JSON.stringify({ event: 'complete-improvement', tailM3: assessment.metrics.tailSolidVolumeMm3 / 1e9, front10Minimum: assessment.metrics.front10MinimumSolidUtilization, elapsedMs: Date.now() - started }))
    accepted = true
    break
  }
  tail.items.pop(); updateContainer(tail)
}
writeFileSync(`${output}/summary.json`, JSON.stringify({ provenance, accepted, elapsedMs: Date.now() - started, globalOptimalityProven: false }, null, 2))
