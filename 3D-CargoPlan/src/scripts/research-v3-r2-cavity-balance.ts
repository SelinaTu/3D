// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { PackingSolution } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { assessResearchCandidate, compareResearchMetrics } from '../core/research-metrics'
import { calculateActualDimensions, canPlaceAt, updateContainer } from '../core/packing-utils'
import { cavityFaceMargins, geometryFor, solidVolume } from '../core/solid-geometry'

const input = 'data/optimization/v3-r2-cavity-finish/best-complete.json', output = 'data/optimization/v3-r2-cavity-balance'
const start = Date.now(), budgetMs = 20000, deadline = start + budgetMs
mkdirSync(output, { recursive: true })
const cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
let solution = JSON.parse(readFileSync(input, 'utf8')).solution as PackingSolution
let assessed = assessResearchCandidate(solution, cal.items, cal.config)
if (!assessed.metrics.eligible) throw Error('Full valid input required')
const provenance = { ...researchCalibrationProvenance(cal), input: { path: input, sha256: researchFileHash(input) }, script: { path: 'src/scripts/research-v3-r2-cavity-balance.ts', sha256: researchFileHash('src/scripts/research-v3-r2-cavity-balance.ts') }, budgetMs, seed: null, scope: 'Only W05 in confirmed authorized cavities, original width vertical, exact wall margins and original full load/support checks; balance front10 bottleneck without moving the tail.' }
writeFileSync(`${output}/input-snapshot.json`, readFileSync(input)); writeFileSync(`${output}/executed-script.ts.txt`, readFileSync('src/scripts/research-v3-r2-cavity-balance.ts'))
const moves: unknown[] = []
let attempts = 0
while (Date.now() < deadline) {
  const front = assessed.metrics.containers.slice(0, 10), low = front.at(-1)!, target = solution.containers[low.sourceIndex]
  let accepted = false
  const donors = front.filter(c => c.sourceIndex !== low.sourceIndex).sort((a, b) => b.solidVolumeMm3 - a.solidVolumeMm3)
  for (const donor of donors) {
    const units = [...solution.containers[donor.sourceIndex].items].filter(p => p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === 8 && donor.solidVolumeMm3 - solidVolume(p.item) > low.solidVolumeMm3).sort((a, b) => b.position.z - a.position.z)
    for (const unit of units) {
      const d = calculateActualDimensions(unit.item.dimensions, 'lying', 0, unit.item.orientationVerticalAxes)
      for (const host of target.items.filter(p => p.item.cavity?.allowedSourceSheets?.includes('门窗'))) {
        const hole = geometryFor(host).cavity!, margin = cavityFaceMargins(host, 5)!, xs = new Set<number>(), ys = new Set<number>(), zs = new Set<number>([hole.min.z + margin.min.z])
        for (let x = hole.min.x + margin.min.x; x + d.length <= hole.max.x - margin.max.x + 1e-6; x += d.length + 5) xs.add(x)
        xs.add(hole.max.x - margin.max.x - d.length)
        ys.add(hole.min.y + margin.min.y); ys.add(hole.max.y - margin.max.y - d.width); ys.add((hole.min.y + hole.max.y - d.width) / 2)
        for (const p of target.items) if (p.position.x >= hole.min.x && p.position.x < hole.max.x && p.position.y >= hole.min.y && p.position.y < hole.max.y) zs.add(p.position.z + p.actualDimensions.height + 5)
        for (const z of [...zs].sort((a, b) => a - b)) for (const y of ys) for (const x of xs) {
          if (Date.now() >= deadline || accepted) break
          if (z + d.height > hole.max.z - margin.max.z + 1e-6) continue
          attempts++; const position = { x, y, z }
          if (!canPlaceAt(unit.item, position, 'lying', 0, target)) continue
          const candidate = structuredClone(solution), source = candidate.containers[donor.sourceIndex], destination = candidate.containers[low.sourceIndex]
          source.items = source.items.filter(p => p.item.id !== unit.item.id); updateContainer(source)
          destination.items.push({ item: unit.item, position, orientation: 'lying', rotation: 0, actualDimensions: d }); updateContainer(destination)
          const next = assessResearchCandidate(candidate, cal.items, cal.config)
          if (!next.metrics.eligible || compareResearchMetrics(next.metrics, assessed.metrics) >= 0) continue
          const record = { id: unit.item.id, from: source.id, to: destination.id, host: host.item.id, position, orientation: 'lying', rotation: 0, front10Minimum: next.metrics.front10MinimumSolidUtilization, elapsedMs: Date.now() - start }
          solution = candidate; assessed = next; moves.push(record); appendFileSync(`${output}/ledger.jsonl`, JSON.stringify(record) + '\n'); accepted = true
          writeFileSync(`${output}/best-complete.json`, JSON.stringify({ provenance, config: cal.config, ...assessed, moves, elapsedMs: Date.now() - start }, null, 2)); console.log(JSON.stringify(record))
        }
        if (accepted || Date.now() >= deadline) break
      }
      if (accepted || Date.now() >= deadline) break
    }
    if (accepted || Date.now() >= deadline) break
  }
  if (!accepted) break
}
writeFileSync(`${output}/summary.json`, JSON.stringify({ provenance, metrics: assessed.metrics, moves, attempts, elapsedMs: Date.now() - start }, null, 2))
console.log(JSON.stringify({ accepted: moves.length, attempts, tailM3: assessed.metrics.tailSolidVolumeMm3 / 1e9, front10Minimum: assessed.metrics.front10MinimumSolidUtilization, elapsedMs: Date.now() - start }))
