// #created 11/08/2026
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Container, PackingSolution, PlacedItem } from '../types/packing'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { calculateActualDimensions, updateContainer } from '../core/packing-utils'
import { placeResearchItem } from '../core/research-placement'
import { assessResearchCandidate, researchHash } from '../core/research-metrics'
import { createPackingSolution } from '../core/solution-builder'
import { superviseResearch } from './research-supervisor'
const out = 'data/optimization/v3-r2-tail-exchange'; mkdirSync(out, { recursive: true })
if (!process.send) {
  const supervision = await superviseResearch({ modulePath: new URL(import.meta.url), args: ['--child'], execArgv: ['--import', 'tsx'], budgetMs: 120000, inheritOutput: true })
  writeFileSync(`${out}/supervision.json`, JSON.stringify(supervision, null, 2))
} else {
  const started = Date.now(), deadline = started + 110000, input = 'data/optimization/v3-tail-independent/frozen-complete.json', bytes = readFileSync(input), original = JSON.parse(bytes.toString()).solution as PackingSolution, cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json')
  const engineFiles = ['src/scripts/research-v3-r2-tail-exchange.ts', 'src/core/research-placement.ts', 'src/core/packing-utils.ts', 'src/core/validation.ts'].map(path => ({ path, sha256: researchFileHash(path) }))
  const provenance = { ...researchCalibrationProvenance(cal), input: { path: input, sha256: researchFileHash(input), snapshotPath: `${out}/input-snapshot.json` }, engineFiles, engineSha256: researchHash(engineFiles), seed: 20261018, budgetMs: 120000, searchBudgetMs: 110000, scope: 'Complete-only structural tail exchange: move source 5 narrow floor rows, remove three W05 roof blockers into authorized empty W02 cavity, extend W06 frame floor pile. Frozen v3 rules unchanged.' }
  writeFileSync(`${out}/input-snapshot.json`, bytes)
  const baseline = assessResearchCandidate(original, cal.items, cal.config)
  if (!baseline.metrics.eligible) throw Error('Baseline invalid')
  const runId = new Date(started).toISOString()
  const log = (entry: unknown) => appendFileSync(`${out}/ledger.jsonl`, JSON.stringify({ runId, inputSha256: provenance.input.sha256, engineSha256: provenance.engineSha256, ...(entry as Record<string, unknown>) }) + '\n')
  log({ event: 'run-start', budgetMs: provenance.budgetMs, seed: provenance.seed })
  let best = original, bestTail = baseline.metrics.tailSolidVolumeMm3, accepted = 0, trials = 0
  const sourceKey = (p: PlacedItem, row: number) => p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === row
  for (const extent of [5, 4, 3, 2, 1]) {
    if (Date.now() >= deadline) break
    const containers: Container[] = structuredClone(original.containers), front = containers[4], tail = containers[2], moves: unknown[] = []
    const blockers = front.items.filter(p => sourceKey(p, 8) && ['u87', 'u6', 'u7'].some(u => p.item.id.endsWith(`:${u}`)))
    if (blockers.length !== 3) throw Error('Unexpected blocker identity')
    front.items = front.items.filter(p => !blockers.includes(p))
    for (const p of front.items) {
      if (sourceKey(p, 18) && p.position.x === 0 && p.position.y === 1650) { p.position.y = 1680; moves.push({ id: p.item.id, to: 4, position: p.position, reason: 'shift W06 floor column beyond short-frame canopy' }) }
      if (sourceKey(p, 14) && p.position.x === 0 && [1865, 2020].includes(p.position.y)) { p.position.y += 30; moves.push({ id: p.item.id, to: 4, position: p.position, reason: 'repack adjacent floor row' }) }
      if (sourceKey(p, 21) && p.position.x === 1035 && [1865, 2020, 2135].includes(p.position.y)) { p.position.y = p.position.y === 1865 ? 1895 : p.position.y === 2020 ? 2010 : 2125; moves.push({ id: p.item.id, to: 4, position: p.position, reason: 'repack adjacent short-frame floor row' }) }
    }
    const outgoing = tail.items.filter(p => sourceKey(p, 18)).sort((a,b) => b.position.z-a.position.z).slice(0, extent)
    tail.items = tail.items.filter(p => !outgoing.includes(p)); updateContainer(front); updateContainer(tail)
    for (const [j, p] of blockers.entries()) {
      const position = { x: 7525 + (j % 2) * 535, y: 0, z: 185 + Math.floor(j / 2) * 535 }, orientation = 'lying' as const
      p.position = position; p.orientation = orientation; p.rotation = 0; p.actualDimensions = calculateActualDimensions(p.item.dimensions, orientation, 0, p.item.orientationVerticalAxes)
      tail.items.push(p); moves.push({ id: p.item.id, to: 2, position, orientation, rotation: 0, reason: 'authorized W02 cavity, original width axis vertical' }); updateContainer(tail)
    }
    for (const [j, p] of outgoing.entries()) { p.position = { x: 0, y: 1680, z: 1020+j*255 }; p.orientation = 'lying'; p.rotation = 0; p.actualDimensions = calculateActualDimensions(p.item.dimensions, 'lying', 0, p.item.orientationVerticalAxes); front.items.push(p); moves.push({ id: p.item.id, to: 4, position: p.position, orientation: p.orientation, reason: 'extend same-source W06 floor column' }); updateContainer(front) }
    trials++
    const solution = createPackingSolution(containers, [], 'V3-R2-STRUCTURAL-TAIL-EXCHANGE', 0, Date.now()-started), assessment = assessResearchCandidate(solution, cal.items, cal.config), improved = assessment.metrics.eligible && assessment.metrics.tailSolidVolumeMm3 < bestTail - 1 && (assessment.metrics.front10MinimumSolidUtilization ?? 0) + 1e-9 >= (baseline.metrics.front10MinimumSolidUtilization ?? 0)
    const record = { trial: trials, extent, elapsedMs: Date.now()-started, eligible: assessment.metrics.eligible, improved, tailM3: assessment.metrics.tailSolidVolumeMm3/1e9, front10Minimum: assessment.metrics.front10MinimumSolidUtilization, errors: assessment.validation.errors, moves }
    log(record); console.log(JSON.stringify({ ...record, moves: undefined, errors: record.errors.slice(0, 8) }))
    if (improved) { best = solution; bestTail = assessment.metrics.tailSolidVolumeMm3; accepted++; writeFileSync(`${out}/best-complete.json`, JSON.stringify({ provenance, config: cal.config, ...assessment, record, globalOptimalityProven: false }, null, 2)); writeFileSync(`${out}/accepted-${accepted}.json`, JSON.stringify({ provenance, config: cal.config, ...assessment, record, globalOptimalityProven: false }, null, 2)); break }
  }
  if (accepted && Date.now() < deadline) {
    const containers: Container[] = structuredClone(best.containers), front = containers[4], tail = containers[2], moves: unknown[] = []
    const pile = front.items.filter(p => sourceKey(p,18) && p.position.x === 0 && p.position.y === 1680).sort((a,b) => a.position.z-b.position.z)
    const incoming = tail.items.filter(p => sourceKey(p,18)).sort((a,b) => b.position.z-a.position.z).slice(0,2)
    tail.items = tail.items.filter(p => !incoming.includes(p))
    const returned = front.items.find(p => sourceKey(p,21) && p.position.x === 1035 && p.position.y === 2125)!
    front.items = front.items.filter(p => p !== returned)
    for (const p of front.items) {
      if (sourceKey(p,14) && p.position.x === 0 && [1895,2050].includes(p.position.y)) p.position.y = p.position.y === 1895 ? 1935 : 2090
      if (sourceKey(p,21) && p.position.x === 1035 && [1895,2010].includes(p.position.y)) p.position.y = p.position.y === 1895 ? 1935 : 2050
    }
    for (const [j,p] of [...pile,...incoming].entries()) { p.position={x:0,y:1680,z:j*215};p.orientation='flat';p.rotation=0;p.actualDimensions=calculateActualDimensions(p.item.dimensions,'flat',0,p.item.orientationVerticalAxes);if(incoming.includes(p))front.items.push(p);moves.push({id:p.item.id,to:4,position:p.position,orientation:p.orientation,reason:'11 high flat W06 frame stack allowed max12; widened row explicitly cleared'}) }
    returned.position={x:9640,y:0,z:0};returned.orientation='standing';returned.rotation=90;returned.actualDimensions=calculateActualDimensions(returned.item.dimensions,'standing',90,returned.item.orientationVerticalAxes);tail.items.push(returned);moves.push({id:returned.item.id,to:2,position:returned.position,orientation:returned.orientation,rotation:90,reason:'return one short frame to empty end strip, never inside cavity'})
    updateContainer(front);updateContainer(tail);trials++
    const candidate=createPackingSolution(containers,[],'V3-R2-STRUCTURAL-FLAT-PILE-EXCHANGE',0,Date.now()-started),assessment=assessResearchCandidate(candidate,cal.items,cal.config),improved=assessment.metrics.eligible&&assessment.metrics.tailSolidVolumeMm3<bestTail-1&&(assessment.metrics.front10MinimumSolidUtilization ?? 0)+1e-9 >= (baseline.metrics.front10MinimumSolidUtilization ?? 0)
    const record={trial:trials,event:'flat-pile-secondary-exchange',eligible:assessment.metrics.eligible,improved,tailM3:assessment.metrics.tailSolidVolumeMm3/1e9,front10Minimum:assessment.metrics.front10MinimumSolidUtilization,errors:assessment.validation.errors,moves,elapsedMs:Date.now()-started};log(record);console.log(JSON.stringify({...record,moves:undefined,errors:record.errors.slice(0,8)}))
    if(improved){best=candidate;bestTail=assessment.metrics.tailSolidVolumeMm3;accepted++;const result={provenance,config:cal.config,...assessment,record,globalOptimalityProven:false};writeFileSync(`${out}/best-complete.json`,JSON.stringify(result,null,2));writeFileSync(`${out}/accepted-${accepted}.json`,JSON.stringify(result,null,2))}
  }
  // Explore bounded dependent roof bundles only after the explicit structural trial.
  if (!accepted && Date.now() < deadline) {
    for (const host of original.containers[2].items.filter(p => p.position.z > 0 && sourceKey(p, 6))) {
      if (Date.now() >= deadline) break
      for (let bi = 0; bi < 11 && Date.now() < deadline; bi++) {
        if (bi === 2) continue
        const containers: Container[] = structuredClone(original.containers), target = containers[bi]
        const dependents = target.items.filter(p => p.position.z > 0 && p.item.weight <= 30 && p.position.x < host.actualDimensions.length && p.actualDimensions.height < 600).slice(-3)
        if (!dependents.length) continue
        target.items = target.items.filter(p => !dependents.includes(p)); containers[2].items = containers[2].items.filter(p => p.item.id !== host.item.id); updateContainer(target); updateContainer(containers[2])
        const place = placeResearchItem(host.item, target, 4, Math.min(deadline, Date.now()+150)); trials++
        if (!place) { log({ trial: trials, event: 'no-host-placement-after-closure', host: host.item.id, target: bi, elapsedMs: Date.now()-started }); continue }
        target.items.push(place); updateContainer(target)
        let valid = true
        for (const p of dependents) { const placed = placeResearchItem(p.item, containers[2], 4, Math.min(deadline, Date.now()+150)); if (!placed) { valid = false; break } containers[2].items.push(placed); updateContainer(containers[2]) }
        if (!valid) { log({ trial: trials, event: 'closure-reinsertion-failed', host: host.item.id, target: bi, elapsedMs: Date.now()-started }); continue }
        const candidate = createPackingSolution(containers, [], 'V3-R2-ROOF-DEPENDENCY-EXCHANGE', 0, Date.now()-started), assessment = assessResearchCandidate(candidate, cal.items, cal.config), improved = assessment.metrics.eligible && assessment.metrics.tailSolidVolumeMm3 < bestTail-1 && (assessment.metrics.front10MinimumSolidUtilization ?? 0)+1e-9 >= (baseline.metrics.front10MinimumSolidUtilization ?? 0)
        log({ trial: trials, event: 'closure-candidate', host: host.item.id, target: bi, eligible: assessment.metrics.eligible, improved, errors: assessment.validation.errors.slice(0,8), elapsedMs: Date.now()-started })
        if (improved) { best = candidate; bestTail = assessment.metrics.tailSolidVolumeMm3; accepted++; writeFileSync(`${out}/best-complete.json`, JSON.stringify({ provenance, config: cal.config, ...assessment, globalOptimalityProven: false }, null, 2)) }
      }
    }
  }
  writeFileSync(`${out}/summary.json`, JSON.stringify({ provenance, trials, accepted, baseline: baseline.metrics, bestTailM3: bestTail/1e9, elapsedMs: Date.now()-started, globalOptimalityProven: false }, null, 2)); process.send?.({ type: 'research-finished', status: 'complete-only-tail-exchange-finished' })
}
