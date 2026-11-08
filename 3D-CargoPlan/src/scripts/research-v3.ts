// #created 11/08/2026
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import type { CargoItem, Container } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash, compareResearchWithPdf, researchReallocation } from '../core/research-calibration'
import { assessResearchCandidate, canonicalResearchSolution, compareResearchMetrics, researchHash } from '../core/research-metrics'
import { createPackingSolution } from '../core/solution-builder'
import { loadingRulesFor } from '../core/loading-profile'
import { validateSolution } from '../core/validation'
import { updateContainer, volume } from '../core/packing-utils'
import { isGlassRack } from '../core/solid-geometry'
import { placeResearchItem } from '../core/research-placement'
import { superviseResearch } from './research-supervisor'

const output = 'data/optimization/v3', budget = Number(process.argv.find(a => a.startsWith('--budget='))?.slice(9) ?? 180000)
mkdirSync(output, { recursive: true })
if (!process.send) {
  const supervision = await superviseResearch({ modulePath: new URL(import.meta.url), args: ['--child', `--budget=${budget}`], execArgv: ['--import', 'tsx'], budgetMs: budget, candidateWallLimitMs: 60000, inheritOutput: true })
  writeFileSync(`${output}/supervision.json`, JSON.stringify({ ...supervision, requestedBudgetMs: budget }, null, 2))
  console.log(JSON.stringify({ event: 'v3-supervision', ...supervision }))
} else {
  const started = Date.now(), deadline = started + budget - 2000, calibration = loadResearchCalibration('data/reconstruction/model-v3-contract.json'), { items, config } = calibration
  const originals = new Map(items.map(i => [i.id, i])), engineFiles = ['src/scripts/research-v3.ts', 'src/core/research-placement.ts', 'src/core/packing-utils.ts', 'src/core/solid-geometry.ts', 'src/core/validation.ts', 'src/core/loading-profile.ts'].map(path => ({ path, sha256: researchFileHash(path) }))
  const provenance = { ...researchCalibrationProvenance(calibration), engineFiles, engineSha256: researchHash(engineFiles), seed: 20261018, startedAt: new Date().toISOString() }
  const write = (name: string, value: unknown) => { const p = `${output}/${name}`; writeFileSync(`${p}.tmp`, JSON.stringify(value, null, 2)); renameSync(`${p}.tmp`, p) }
  const adapt = (c: Container, id: string): Container => { const copy = { ...structuredClone(c), id, loadingRules: loadingRulesFor(items, config), items: c.items.map(p => ({ ...structuredClone(p), item: originals.get(p.item.id)! })) }; updateContainer(copy); return copy }
  const legacyPath = 'data/calibration/current-best-research.json', prior = JSON.parse(readFileSync(legacyPath, 'utf8'))
  let best = assessResearchCandidate(createPackingSolution(prior.solution.containers.map((c: Container, i: number) => adapt(c, `v3-${i + 1}`)), [], 'V3-REVALIDATED-COMPLETE-SEED', 0, 0), items, config)
  if (!best.metrics.eligible) throw new Error(JSON.stringify(best.validation))
  const save = (kind: string, assessed = best) => {
    const solution = canonicalResearchSolution(assessed)
    write('best-complete.json', { provenance, config, solution, metrics: assessed.metrics, validation: assessed.validation, pdfComparison: compareResearchWithPdf(assessed.metrics, calibration), reallocation: researchReallocation(solution, calibration), event: { kind, elapsedMs: Date.now() - started }, originalSeed: { path: legacyPath, sha256: researchFileHash(legacyPath) } })
  }
  save('same-coordinates-new-model-independent-validation')
  appendFileSync(`${output}/ledger.jsonl`, `${JSON.stringify({ event: 'complete-seed', provenance, metrics: best.metrics, originalSeed: { path: legacyPath, sha256: researchFileHash(legacyPath) } })}\n`)
  const paths: string[] = []
  for (const directory of ['data/reconstruction/v3', 'data/reconstruction', 'delivery-output/reconstruction/v2', 'delivery-output/reconstruction/v2-racktop']) {
    if (!existsSync(directory)) continue
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const p = `${directory}/${entry.name}`
      if (entry.isFile() && /^container-\d+\.json$/.test(entry.name)) paths.push(p)
      if (entry.isDirectory() && existsSync(`${p}/result.json`)) paths.push(`${p}/result.json`)
    }
  }
  const candidates: { number: number; container: Container; loaded: number; racks: number; path: string }[] = []
  for (const path of paths) {
    try {
      const a = JSON.parse(readFileSync(path, 'utf8')), allocation = calibration.pdfAllocation.find(c => c.containerNumber === a.sourceContainerNumber)
      if (!allocation || a.solution?.containers?.length !== 1) continue
      const c = adapt(a.solution.containers[0], `source-${a.sourceContainerNumber}`), allowed = new Set(allocation.ids)
      if (c.items.some(p => !allowed.has(p.item.id))) continue
      const ids = new Set(c.items.map(p => p.item.id)), subset = items.filter(i => allowed.has(i.id)), partial = createPackingSolution([c], subset.filter(i => !ids.has(i.id)), 'FIXED-SEED-V3-RECHECK', 0, 0)
      c.loadingRules = loadingRulesFor(subset, config)
      if (!validateSolution(partial, subset, config).valid) continue
      c.loadingRules = loadingRulesFor(items, config)
      candidates.push({ number: allocation.containerNumber, container: c, loaded: c.items.length, racks: c.items.filter(p => isGlassRack(p.item)).length, path })
    } catch { /* An incomplete write or incompatible candidate never enters the pool. */ }
  }
  for (let trial = 0; trial < 8 && Date.now() < deadline; trial++) {
    process.send?.({ type: 'candidate-start', trial })
    const trialStart = Date.now(), until = Math.min(deadline, trialStart + 50000), mode = trial % 6
    let containers: Container[], sourcePaths: string[], pool: CargoItem[]
    if (trial < 5) {
      const selected = calibration.pdfAllocation.map(a => candidates.filter(c => c.number === a.containerNumber).sort((a, b) => (trial % 2 === 0 ? b.racks - a.racks : 0) || b.loaded - a.loaded || a.path.localeCompare(b.path))[0])
      if (selected.some(c => !c)) break
      containers = selected.map((c, i) => adapt(c.container, `v3-fixed-${i + 1}`)); sourcePaths = selected.map(c => c.path)
      const ids = new Set(containers.flatMap(c => c.items.map(p => p.item.id))); pool = items.filter(i => !ids.has(i.id))
    } else {
      const base = canonicalResearchSolution(best), removed = trial === 5 ? [base.containers.length - 1] : trial === 6 ? [3] : [base.containers.length - 2]
      containers = base.containers.filter((_, i) => !removed.includes(i)).map((c, i) => adapt(c, `v3-repack-${i + 1}`)); sourcePaths = ['current-best-complete']; pool = removed.flatMap(i => base.containers[i].items.map(p => p.item))
    }
    const initialPool = pool.length, records: unknown[] = [], attempts = new Map<string, number>()
    const order = (a: CargoItem, b: CargoItem) => Number(isGlassRack(b)) - Number(isGlassRack(a)) || (mode % 2 ? Math.max(...Object.values(b.dimensions)) - Math.max(...Object.values(a.dimensions)) : volume(b.dimensions) - volume(a.dimensions))
    for (let pass = 0; pass < 3 && pool.length && Date.now() < until; pass++) {
      const remaining: CargoItem[] = []
      for (const item of [...pool].sort(order)) {
        if (Date.now() >= until) { remaining.push(item); continue }
        let placed = false
        const bins = [...containers].sort((a, b) => trial % 2 ? a.volumeUtilization - b.volumeUtilization : b.volumeUtilization - a.volumeUtilization)
        for (const c of bins) {
          const p = placeResearchItem(item, c, mode, Math.min(until, Date.now() + 160)); attempts.set(item.id, (attempts.get(item.id) ?? 0) + 1)
          if (p) { c.items.push(p); updateContainer(c); placed = true; records.push({ id: item.id, target: c.id, position: p.position, orientation: p.orientation, rotation: p.rotation, pass }); break }
        }
        if (!placed) remaining.push(item)
      }
      pool = remaining
    }
    const solution = createPackingSolution(containers, pool, `V3-CROSS-CONTAINER-${trial}`, 0, Date.now() - trialStart), assessed = assessResearchCandidate(solution, items, config)
    const accepted = assessed.metrics.eligible && compareResearchMetrics(assessed.metrics, best.metrics) < 0
    const record = { trial, mode, sourcePaths, initialPool, elapsedMs: Date.now() - trialStart, metrics: assessed.metrics, errors: assessed.validation.errors, accepted, moves: records, missing: pool.map(i => ({ id: i.id, attempts: attempts.get(i.id), reason: 'No accepted variant at bounded expanded anchors; not an infeasibility proof' })) }
    appendFileSync(`${output}/ledger.jsonl`, `${JSON.stringify(record)}\n`)
    if (accepted) { best = assessed; save(`cross-container-trial-${trial}`); write(`improvement-${trial}.json`, { provenance, config, solution: canonicalResearchSolution(best), validation: best.validation, metrics: best.metrics, record }) }
    if (assessed.validation.valid) write(`candidate-${trial}.json`, { provenance, config, solution, validation: assessed.validation, metrics: assessed.metrics, record })
    console.log(JSON.stringify({ event: 'v3-candidate', trial, containers: assessed.metrics.totalContainers, loaded: assessed.metrics.placedItems, missing: pool.length, valid: assessed.validation.valid, accepted, elapsedMs: record.elapsedMs }))
    process.send?.({ type: 'candidate-finish', trial })
    if (best.metrics.eligible && best.metrics.totalContainers <= 11) break
  }
  write('summary.json', { provenance, config, elapsedMs: Date.now() - started, bestMetrics: best.metrics, validation: best.validation, pdfComparison: compareResearchWithPdf(best.metrics, calibration) })
  process.send?.({ type: 'research-finished', status: Date.now() >= deadline ? 'budget-exhausted' : 'trial-limit' })
}
