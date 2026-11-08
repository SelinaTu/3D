// #created 11/08/2026
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PackingSolution, Orientation, Position3D } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate, physicalLayoutHash } from '../core/research-metrics'
import { calculateActualDimensions, canPlaceAt, updateContainer } from '../core/packing-utils'
import { createPackingSolution } from '../core/solution-builder'

const [oldResultPath, oldInputSnapshotPath, newInputPath, outputPath] = process.argv.slice(2)
if (!outputPath) throw Error('Usage: recorded-result recorded-input-snapshot stable-new-input output')
const started = Date.now(), cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const old = read(oldResultPath) as { solution: PackingSolution; provenance: { input: { sha256: string } }; moves: { id: string; from: string; to: string; position: Position3D; orientation: Orientation; rotation: number }[] }
const previousInput = read(oldInputSnapshotPath).solution as PackingSolution
let solution = read(newInputPath).solution as PackingSolution
if (old.provenance.input.sha256 !== researchFileHash(oldInputSnapshotPath)) throw Error('Recorded input snapshot SHA differs')
if (physicalLayoutHash(previousInput) !== physicalLayoutHash(solution)) throw Error('Stable inputs differ physically; blind replay is forbidden')
const checks: unknown[] = []
for (const move of old.moves) {
  const source = solution.containers.find(c => c.id === move.from)!, target = solution.containers.find(c => c.id === move.to)!
  const p = source?.items.find(p => p.item.id === move.id)
  if (!p || !target) throw Error(`Missing transfer identity ${move.id}`)
  source.items = source.items.filter(q => q.item.id !== p.item.id); updateContainer(source)
  if (!canPlaceAt(p.item, move.position, move.orientation, move.rotation, target)) throw Error(`Replay placement rejected: ${move.id}`)
  target.items.push({ ...p, position: move.position, orientation: move.orientation, rotation: move.rotation, actualDimensions: calculateActualDimensions(p.item.dimensions, move.orientation, move.rotation, p.item.orientationVerticalAxes) }); updateContainer(target)
  solution = createPackingSolution(solution.containers, [], 'V3-R2-RECORDED-TRANSFER-REPLAY', 0, Date.now() - started)
  const checked = assessResearchCandidate(solution, cal.items, cal.config)
  if (!checked.metrics.eligible) throw Error(JSON.stringify(checked.validation.errors))
  checks.push({ id: move.id, valid: true, physicalLayoutSha256: checked.metrics.physicalLayoutSha256 })
}
const assessed = assessResearchCandidate(solution, cal.items, cal.config)
if (assessed.metrics.physicalLayoutSha256 !== physicalLayoutHash(old.solution)) throw Error('Replay did not reproduce the recorded final layout')
const provenance = { ...researchCalibrationProvenance(cal), replayInputs: [oldResultPath, oldInputSnapshotPath, newInputPath].map(path => ({ path, sha256: researchFileHash(path) })), script: { path: 'src/scripts/replay-v3-r2-transfers.ts', sha256: researchFileHash('src/scripts/replay-v3-r2-transfers.ts') }, scope: 'Deterministic replay of recorded moves on byte-stable parents with identical physical layout; every intermediate full plan is independently checked.' }
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify({ provenance, config: cal.config, ...assessed, replayChecks: checks, elapsedMs: Date.now() - started }, null, 2))
console.log(JSON.stringify({ outputPath, moves: checks.length, valid: assessed.metrics.eligible, tailM3: assessed.metrics.tailSolidVolumeMm3 / 1e9, front10Minimum: assessed.metrics.front10MinimumSolidUtilization, matchedRecordedLayout: true }))
