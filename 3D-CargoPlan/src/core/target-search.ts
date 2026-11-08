// #created 11/08/2026
/** Experimental, bounded order research. Not an API/default algorithm. */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CargoItem, OptimizationConfig, PackingSolution } from '../types/packing'
import { normalizeItems, packInOrder } from './greedy-algorithm'
import { calculateActualDimensions, orientationsFor, volume } from './packing-utils'
import { loadingRulesFor } from './loading-profile'
import { assessResearchCandidate, canonicalResearchSolution, isResearchImprovement, researchHash } from './research-metrics'
import type { AssessedResearchCandidate } from './research-metrics'
import { assertResearchCalibration, researchCalibrationProvenance, compareResearchWithPdf, researchReallocation } from './research-calibration'
import type { ResearchCalibration } from './research-calibration'

type Feature = 'rigidity' | 'volume' | 'footprint' | 'longest' | 'weight' | 'quantity' | 'canSupport' | 'thinness' | 'cavity'
type Weights = Partial<Record<Feature, number>>
interface Group { key: string; items: CargoItem[]; features: Record<Feature, number> }
interface Trial { name: string; weights?: Weights; noise?: number; mode?: 'default' | 'slim' | 'low' | 'long-flat' | 'cavity-tall'; order?: string[] }
export interface TargetResearchOptions { outputDir: string; calibration: ResearchCalibration; baseline?: PackingSolution; cpuBudgetMs?: number; candidateTimeLimitMs?: number; maxTrials?: number; targetContainers?: number; seed?: number }
const features: Feature[] = ['rigidity', 'volume', 'footprint', 'longest', 'weight', 'quantity', 'canSupport', 'thinness', 'cavity']
const sourceKey = (i: CargoItem) => `${String(i.rawData._sourceSheet ?? '')}/${String(i.rawData._sourceRow ?? i.id)}`
function rng(seed: number) { let state = seed >>> 0; return () => { state = Math.imul(1664525, state) + 1013904223 >>> 0; return state / 4294967296 } }
function groupsFor(items: CargoItem[], config: OptimizationConfig): Group[] {
  const rules = loadingRulesFor(items, config)
  const map = new Map<string, CargoItem[]>()
  for (const item of items) { const key = sourceKey(item); map.set(key, [...(map.get(key) ?? []), item]) }
  const groups = [...map].map(([key, units]) => {
    const item = units[0], d = item.dimensions
    const heightLimit = rules?.heightExceptions[item.id] ?? config.containerDimensions.height
    const legal = orientationsFor(item).filter(v => v.dimensions.height <= heightLimit && ((v.dimensions.length <= config.containerDimensions.length && v.dimensions.width <= config.containerDimensions.width) || (v.dimensions.width <= config.containerDimensions.length && v.dimensions.length <= config.containerDimensions.width)))
    const footprint = Math.min(...legal.map(v => v.dimensions.length * v.dimensions.width))
    return { key, items: units, features: { rigidity: 6 - legal.length, volume: Math.log1p(volume(d)), footprint: Math.log1p(Number.isFinite(footprint) ? footprint : volume(d)), longest: Math.log1p(Math.max(d.length, d.width, d.height)), weight: Math.log1p(item.weight), quantity: Math.log1p(units.length), canSupport: Number(item.canStackOnTop), thinness: Math.log1p(Math.max(d.length, d.width, d.height) / Math.min(d.length, d.width, d.height)), cavity: item.cavity ? Math.log1p(volume(item.cavity.dimensions)) : 0 } }
  })
  for (const name of features) {
    const min = Math.min(...groups.map(g => g.features[name])), max = Math.max(...groups.map(g => g.features[name]))
    for (const group of groups) group.features[name] = (group.features[name] - min) / (max - min || 1)
  }
  return groups
}
function orientationPreference(item: CargoItem, mode: Trial['mode'], config: OptimizationConfig): CargoItem {
  if (!mode || mode === 'default') return item
  if (mode === 'long-flat' && !(item.dimensions.length > config.containerDimensions.length / 2 && item.dimensions.width > item.dimensions.height * 3)) return item
  if (mode === 'cavity-tall' && !item.cavity) return item
  const heightLimit = loadingRulesFor([item], config)?.heightExceptions[item.id] ?? config.containerDimensions.height
  const score = (o: CargoItem['allowedOrientations'][number]) => {
    const d = calculateActualDimensions(item.dimensions, o, 0, item.orientationVerticalAxes)
    if (d.height > heightLimit || !((d.length <= config.containerDimensions.length && d.width <= config.containerDimensions.width) || (d.width <= config.containerDimensions.length && d.length <= config.containerDimensions.width))) return Infinity
    return mode === 'slim' ? d.length * d.width : mode === 'cavity-tall' ? -calculateActualDimensions(item.cavity!.dimensions, o, 0, item.orientationVerticalAxes).height : d.height
  }
  return { ...item, allowedOrientations: [...item.allowedOrientations].sort((a, b) => score(a) - score(b)) }
}

/** Records exact envelopes, original input digest, order and independent validation. */
export function runTargetResearch(input: CargoItem[], config: OptimizationConfig, options: TargetResearchOptions, report: (record: Record<string, unknown>) => void = () => {}): PackingSolution | undefined {
  // This function is never called by preparation, calibration or unit tests.
  assertResearchCalibration(options.calibration, input, config)
  const start = Date.now(), budget = options.cpuBudgetMs ?? 600000
  if (!Number.isFinite(budget) || budget <= 0 || budget > 600000) throw new Error('研究总预算必须在 1..600000 ms 内')
  const candidateBudget = options.candidateTimeLimitMs ?? 60000, maxTrials = options.maxTrials ?? 70, seed = options.seed ?? 88371
  if (!Number.isInteger(maxTrials) || maxTrials < 1 || maxTrials > 100 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isFinite(candidateBudget) || candidateBudget <= 0 || candidateBudget > 60000) throw new Error('候选预算、试验数量或 seed 无效')
  const deadline = start + budget, units = normalizeItems(input), groups = groupsFor(units, config), random = rng(seed)
  const provenance = researchCalibrationProvenance(options.calibration)
  mkdirSync(options.outputDir, { recursive: true })
  const ledgerPath = join(options.outputDir, 'order-search-ledger.jsonl'), baselinePath = join(options.outputDir, 'calibrated-baseline.json')
  const sessionPath = join(options.outputDir, 'research-session.json')
  const session = { provenance, config, seed, budgetMs: budget, candidateBudgetMs: candidateBudget, maxTrials, objective: ['complete and independently valid under calibrated config', 'fewer containers', 'at 11 containers: smaller canonical tail solid volume', 'at 11 containers with equal tail: larger minimum solid utilization among first ten'], startedAt: new Date().toISOString() }
  if (existsSync(sessionPath)) {
    const prior = JSON.parse(readFileSync(sessionPath, 'utf8'))
    if (prior.provenance?.calibrationHash !== provenance.calibrationHash || prior.seed !== seed) throw new Error('输出目录已有不同校准或 seed 的研究，请使用新的输出目录')
  } else writeFileSync(sessionPath, JSON.stringify(session, null, 2), { flag: 'wx' })
  let baseline: AssessedResearchCandidate | undefined, best: AssessedResearchCandidate | undefined, bestOrder: string[] | undefined
  const persistBaseline = (assessed: AssessedResearchCandidate) => {
    if (!assessed.metrics.eligible) return
    if (!baseline) {
      baseline = assessed
      if (!existsSync(baselinePath)) writeFileSync(baselinePath, JSON.stringify({ provenance, config, seed, solution: canonicalResearchSolution(assessed), validation: assessed.validation, metrics: assessed.metrics, establishedAt: new Date().toISOString(), note: 'First complete, independently valid solution under this exact calibrated contract. No comparison with an unmodeled PDF layout is implied.' }, null, 2), { flag: 'wx' })
      report({ event: 'baseline-established', baselinePath, containers: assessed.metrics.totalContainers, physicalLayoutSha256: assessed.metrics.physicalLayoutSha256 })
    }
    if (!best || isResearchImprovement(assessed.metrics, best.metrics)) best = assessed
  }
  if (existsSync(baselinePath)) {
    const stored = JSON.parse(readFileSync(baselinePath, 'utf8'))
    if (stored.provenance?.calibrationHash !== provenance.calibrationHash) throw new Error('保存基线不属于本次校准')
    const assessed = assessResearchCandidate(stored.solution, units, config)
    if (!assessed.metrics.eligible || stored.metrics?.physicalLayoutSha256 !== assessed.metrics.physicalLayoutSha256) throw new Error('保存基线未通过独立校验或布局指纹不符')
    baseline = assessed; best = assessed
  }
  if (options.baseline) {
    const assessed = assessResearchCandidate(options.baseline, units, config)
    if (!assessed.metrics.eligible) throw new Error('指定基线不是同口径的完整有效方案；可省略 baseline，由研究建立首份完整基线')
    persistBaseline(assessed)
  }
  const allTrials: Trial[] = [
    { name: 'volume-long-flat', weights: { volume: 1 }, mode: 'long-flat' },
    { name: 'rigidity-volume-long-flat', weights: { rigidity: 100, volume: 1 }, mode: 'long-flat' },
    { name: 'cavity-first-tall', weights: { cavity: 100, rigidity: 1, volume: 0.1 }, mode: 'cavity-tall' },
    { name: 'cavity-first-default', weights: { cavity: 100, rigidity: 1, volume: 0.1 } },
    { name: 'rigidity-cavity-tall', weights: { rigidity: 100, cavity: 10, volume: 1 }, mode: 'cavity-tall' },
    { name: 'footprint-long-flat', weights: { footprint: 100, volume: 0.01 }, mode: 'long-flat' },
    { name: 'longest-long-flat', weights: { longest: 100, volume: 1 }, mode: 'long-flat' },
    { name: 'rigidity-volume-default', weights: { rigidity: 100, volume: 1 } },
    { name: 'rigidity-volume-slim', weights: { rigidity: 100, volume: 1 }, mode: 'slim' },
    { name: 'rigidity-footprint-slim', weights: { rigidity: 100, footprint: 1 }, mode: 'slim' },
    { name: 'footprint-default', weights: { footprint: 100, volume: 0.01 } },
    ...[0.25, 0.5, 1, 2, 4, 8, 16].flatMap(w => [
      { name: `rigidity-${w}-volume`, weights: { rigidity: w, volume: 1 } },
      { name: `rigidity-${w}-footprint-slim`, weights: { rigidity: w, footprint: 1 }, mode: 'slim' as const }
    ]),
  ]
  for (let trialIndex = 0; trialIndex < maxTrials && Date.now() < deadline; trialIndex++) {
    assertResearchCalibration(options.calibration, units, config)
    let trial = allTrials[trialIndex]
    if (!trial) {
      if (bestOrder && random() < 0.6) {
        const order = [...bestOrder], i = Math.floor(random() * order.length), size = 1 + Math.floor(random() * 5), removed = order.splice(i, size), j = Math.floor(random() * (order.length + 1))
        order.splice(j, 0, ...removed)
        if (random() < 0.3) order.reverse()
        trial = { name: `group-block-move-${trialIndex}`, order, mode: random() < 0.5 ? 'slim' : 'default' }
      } else trial = { name: `weighted-${trialIndex}`, weights: { rigidity: random() * 5, volume: random() * 2, footprint: random() * 2, longest: random(), weight: random() - 0.3, quantity: random() - 0.7, canSupport: random() - 0.5, thinness: random() - 0.5, cavity: random() }, noise: random() * 0.25, mode: random() < 0.5 ? 'slim' : 'default' }
    }
    let ordered: Group[]
    if (trial.order) { const priority = new Map(trial.order.map((id, i) => [id, i])); ordered = [...groups].sort((a, b) => (priority.get(a.key) ?? Infinity) - (priority.get(b.key) ?? Infinity)) }
    else {
      const scores = new Map(groups.map(g => [g.key, features.reduce((sum, name) => sum + g.features[name] * (trial.weights?.[name] ?? 0), 0) + (random() - 0.5) * (trial.noise ?? 0)]))
      ordered = [...groups].sort((a, b) => scores.get(b.key)! - scores.get(a.key)! || volume(b.items[0].dimensions) - volume(a.items[0].dimensions))
    }
    const order = ordered.flatMap(g => g.items.map(i => orientationPreference(i, trial.mode, config)))
    const candidateStart = Date.now(), candidateLimit = Math.min(candidateBudget, deadline - candidateStart)
    if (candidateLimit <= 0) break
    const solution = packInOrder(order, { ...config, deadline: candidateStart + candidateLimit, timeLimit: candidateLimit }, false, `ORDER-RESEARCH-${trialIndex}`)
    const assessed = assessResearchCandidate(solution, units, config), previousBest = best
    const improved = assessed.metrics.eligible && (!best || isResearchImprovement(assessed.metrics, best.metrics))
    if (assessed.metrics.eligible && !baseline) persistBaseline(assessed)
    if (improved) { best = assessed; bestOrder = ordered.map(g => g.key) }
    const record = { event: 'candidate', trialIndex, ...trial, seed, candidateMs: Date.now() - candidateStart, totalMs: Date.now() - start, provenance, metrics: assessed.metrics, pdfComparison: compareResearchWithPdf(assessed.metrics, options.calibration), validation: assessed.validation, improved, baselinePhysicalLayoutSha256: baseline?.metrics.physicalLayoutSha256 ?? null, groupOrder: ordered.map(g => g.key), physicalItemOrderSha256: researchHash(order.map(i => i.id)) }
    appendFileSync(ledgerPath, JSON.stringify(record) + '\n'); report(record)
    if (improved && best) {
      const snapshot = { provenance, config, seed, trial: record, solution: canonicalResearchSolution(best), validation: best.validation, metrics: best.metrics, priorBestMetrics: previousBest?.metrics ?? null, pdfComparison: compareResearchWithPdf(best.metrics, options.calibration), reallocation: researchReallocation(canonicalResearchSolution(best), options.calibration), physicalItemOrder: order.map(i => i.id), comparison: 'Actual placement fingerprint and calibrated objective changed; container renumbering alone never counts.' }
      writeFileSync(join(options.outputDir, 'best-current-order-research.json'), JSON.stringify(snapshot, null, 2))
      if (previousBest) writeFileSync(join(options.outputDir, `improvement-${trialIndex}-${best.metrics.totalContainers}-containers.json`), JSON.stringify(snapshot, null, 2))
    }
    if (assessed.metrics.eligible && assessed.metrics.totalContainers <= (options.targetContainers ?? 10)) {
      writeFileSync(join(options.outputDir, `validated-${assessed.metrics.totalContainers}-containers-trial-${trialIndex}.json`), JSON.stringify({ provenance, config, seed, record, solution: canonicalResearchSolution(assessed), validation: assessed.validation, metrics: assessed.metrics, physicalItemOrder: order.map(i => i.id) }, null, 2)); break
    }
  }
  return best ? canonicalResearchSolution(best) : undefined
}

/** Pure dimensional opportunity audit; never represents a supported placement. */
export function auditCavityOpportunities(input: CargoItem[], config: OptimizationConfig, outputPath: string): void {
  const units = normalizeItems(input), groups = groupsFor(units, config), rules = loadingRulesFor(units, config)
  const gap = rules?.clearanceMm ?? 0
  const opportunities: Record<string, unknown>[] = []
  for (const group of groups) {
    const host = group.items[0]
    if (!host.cavity) continue
    for (const hostVariant of orientationsFor(host)) {
      const ceiling = rules?.heightExceptions[host.id] ?? config.containerDimensions.height
      if (hostVariant.dimensions.length > config.containerDimensions.length || hostVariant.dimensions.width > config.containerDimensions.width || hostVariant.dimensions.height > ceiling) continue
      const inner = calculateActualDimensions(host.cavity.dimensions, hostVariant.orientation, hostVariant.rotation, host.orientationVerticalAxes)
      const matches: Record<string, unknown>[] = []
      for (const childGroup of groups) {
        const child = childGroup.items[0]
        if (!host.cavity.allowedSourceSheets?.includes(String(child.rawData._sourceSheet))) continue
        const fits = orientationsFor(child).filter(variant =>
          (!host.cavity!.doorOrientation || child.rawData._sourceSheet !== '门窗' || variant.orientation === host.cavity!.doorOrientation) &&
          variant.dimensions.length + gap * 2 <= inner.length && variant.dimensions.width + gap * 2 <= inner.width && variant.dimensions.height + gap * 2 <= inner.height)
        if (!fits.length) continue
        const gridCapacity = Math.max(...fits.map(v => Math.floor((inner.length - gap) / (v.dimensions.length + gap)) * Math.floor((inner.width - gap) / (v.dimensions.width + gap)) * Math.floor((inner.height - gap) / (v.dimensions.height + gap))))
        matches.push({ childKey: childGroup.key, name: child.name, unitsAvailable: childGroup.items.length, dimensions: child.dimensions, orientations: fits.map(v => ({ orientation: v.orientation, rotation: v.rotation, actualDimensions: v.dimensions })), dimensionalGridUpperBoundPerHost: gridCapacity, availableEnvelopeVolumeM3: childGroup.items.length * volume(child.dimensions) / 1e9 })
      }
      opportunities.push({ hostKey: group.key, name: host.name, hostQuantity: group.items.length, hostOrientation: hostVariant.orientation, rotation: hostVariant.rotation, hostDimensions: hostVariant.dimensions, cavityDimensions: inner, matches })
    }
  }
  const report = { generatedAt: new Date().toISOString(), inputSha256: createHash('sha256').update(JSON.stringify(units)).digest('hex'), config, clearanceMm: gap, status: 'DIMENSIONAL OPPORTUNITY ONLY: no support, weight, stacking, load transfer, global allocation or full-solution proof. No vertical spacers assumed.', opportunities }
  writeFileSync(outputPath, JSON.stringify(report, null, 2))
}
