// #created 11/08/2026
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { analyzeStacking, updateContainer } from '../core/packing-utils'
import { isGlassRack, nestedInside } from '../core/solid-geometry'
import { assessResearchCandidate } from '../core/research-metrics'
import { loadResearchCalibration, researchCalibrationProvenance, researchFileHash } from '../core/research-calibration'
import { createPackingSolution } from '../core/solution-builder'
import { startReplayRecord } from './replay-run-record'
import type { PackingSolution, PlacedItem } from '../types/packing'

const finish = startReplayRecord(import.meta.url), cal = loadResearchCalibration('data/reconstruction/model-v3-contract.json'), input = process.argv[2] ?? 'data/optimization/v3-combined/best-partial.json', source = JSON.parse(readFileSync(input, 'utf8')) as { solution: PackingSolution }, containers = structuredClone(source.solution.containers), output = 'data/optimization/v3-cpsat-frame-transfer'
mkdirSync(output, { recursive: true })
const scale = 2, groups: {required: boolean; score: number; quantity: number; originalBin?: number; original?: number[]; size: number[]; weightGrams: number; units: {item: PlacedItem['item']; orientation: PlacedItem['orientation']; rotation: number; x: number; y: number; z: number}[]; boxes: unknown[]}[] = [], old = new Map<string, {placements: PlacedItem[]; x: number; y: number}>()
const bins = containers.map((c, bi) => {
  const parent = c.items.map((_, i) => i), find = (i: number): number => parent[i] === i ? i : parent[i] = find(parent[i]), join = (i: number, j: number) => { parent[find(i)] = find(j) }, analysis = analyzeStacking(c.items, c.loadingRules)
  if (analysis.errors.length) throw new Error(JSON.stringify(analysis.errors))
  analysis.supports.forEach((ss, i) => ss.forEach(s => join(i, s.index)))
  for (let i = 0; i < c.items.length; i++) for (let j = i + 1; j < c.items.length; j++) if (nestedInside(c.items[i], c.items[j]) || nestedInside(c.items[j], c.items[i])) join(i, j)
  const parts = new Map<number, PlacedItem[]>(); c.items.forEach((p, i) => parts.set(find(i), [...(parts.get(find(i)) ?? []), p]))
  const components = []; let removedWeight = 0
  for (const placements of parts.values()) {
    const x = Math.min(...placements.map(p => p.position.x)), y = Math.min(...placements.map(p => p.position.y)), size = [Math.max(...placements.map(p => p.position.x + p.actualDimensions.length)) - x, Math.max(...placements.map(p => p.position.y + p.actualDimensions.width)) - y].map(v => Math.round(v * scale))
    const boxes = placements.map(p => ({ x: Math.round((p.position.x - x) * scale), y: Math.round((p.position.y - y) * scale), w: Math.round(p.actualDimensions.length * scale), h: Math.round(p.actualDimensions.width * scale), z0: Math.round(p.position.z * scale), z1: Math.round((p.position.z + p.actualDimensions.height) * scale), rack: isGlassRack(p.item) }))
    const frameTransfer = bi === 7 && placements.some(p => p.item.rawData._sourceSheet === '门窗' && p.item.rawData._sourceRow === 16)
    if (frameTransfer) {
      const weight = placements.reduce((s, p) => s + p.item.weight, 0); removedWeight += weight
      groups.push({ required: true, score: 0, quantity: placements.length, originalBin: bi, original: [x, y].map(v => Math.round(v * scale)), size, weightGrams: Math.round(weight * 1000), units: placements.map(p => ({ item: p.item, orientation: p.orientation, rotation: p.rotation, x: p.position.x - x, y: p.position.y - y, z: p.position.z })), boxes })
    } else {
      const id: string = `bin${bi}-component${components.length}`, frozen = bi === 5 || !placements.some(p => p.position.z === 0) || placements.some(p => isGlassRack(p.item) || p.item.rawData._sourceSheet === '门窗' && [9, 16, 23].includes(Number(p.item.rawData._sourceRow)) || p.item.rawData._sourceSheet === '辅材' && p.item.weight > 600)
      components.push({ id, original: [x, y].map(v => Math.round(v * scale)), size, boxes, frozen }); old.set(id, { placements, x, y })
    }
  }
  return { id: c.id, weightGrams: Math.round((c.totalWeight - removedWeight) * 1000), components }
})
for (const item of source.solution.unpackedItems.filter(i => i.rawData._sourceSheet === '门窗' && i.rawData._sourceRow === 9)) groups.push({ required: false, score: 1, quantity: 1, size: [6060, 240], weightGrams: Math.round(item.weight * 1000), units: [{ item, orientation: 'lying', rotation: 0, x: 0, y: 0, z: 0 }], boxes: [{ x: 0, y: 0, w: 6060, h: 240, z0: 0, z1: 4060, rack: false }] })
const problem = { scale, length: 23200, width: 4500, maxWeightGrams: cal.config.containerMaxWeight * 1000, bins, groups }
writeFileSync(`${output}/problem.json`, JSON.stringify(problem))
console.log(JSON.stringify({ event: 'frame-transfer-problem', requiredFrameGroups: groups.filter(g => g.required).length, optionalW07: groups.filter(g => !g.required).length }))
const run = spawnSync('python3', ['scripts/solve-v3-floor-cpsat.py', `${output}/problem.json`, `${output}/answer.json`, '60'], { env: { ...process.env, PYTHONPATH: '/private/tmp/container-packing-solver' }, encoding: 'utf8', timeout: 85000 })
writeFileSync(`${output}/solver.log`, run.stdout ?? ''); writeFileSync(`${output}/solver.stderr`, run.stderr ?? '')
const answerPath = existsSync(`${output}/answer.json`) ? `${output}/answer.json` : `${output}/answer.json.checkpoint.json`, answer = JSON.parse(readFileSync(answerPath, 'utf8'))
if (!answer.old) throw new Error(`No feasible solver answer: ${answer.status}`)
containers.forEach(c => { c.items = [] })
for (const entry of answer.old) { const before = old.get(entry.id)!; containers[entry.bin].items.push(...before.placements.map(p => ({ ...p, position: { x: p.position.x + entry.x / scale - before.x, y: p.position.y + entry.y / scale - before.y, z: p.position.z } }))) }
for (const entry of answer.added) for (const u of groups[entry.group].units) { const original = source.solution.containers.flatMap(c => c.items).find(p => p.item.id === u.item.id); containers[entry.bin].items.push({ item: u.item, orientation: u.orientation, rotation: u.rotation, position: { x: entry.x / scale + u.x, y: entry.y / scale + u.y, z: u.z }, actualDimensions: original?.actualDimensions ?? { length: 3030, width: 120, height: 2030 } }) }
containers.forEach(updateContainer)
const used = new Set(containers.flatMap(c => c.items.map(p => p.item.id))), assessed = assessResearchCandidate(createPackingSolution(containers, cal.items.filter(i => !used.has(i.id)), 'V3-CP-SAT-CROSS-BIN-W02-FRAME-TRANSFER', 0, 0), cal.items, cal.config)
const record = { provenance: { ...researchCalibrationProvenance(cal), input, inputSha256: researchFileHash(input), problemSha256: researchFileHash(`${output}/problem.json`), answerSha256: researchFileHash(answerPath), solverSha256: researchFileHash('scripts/solve-v3-floor-cpsat.py') }, config: cal.config, ...assessed, execution: finish(), solver: { status: answer.status, objective: answer.objective, bound: answer.bestBound, wallTime: answer.wallTime, globalOptimalityProven: false } }
writeFileSync(`${output}/checked-result.json`, JSON.stringify(record, null, 2))
if (assessed.validation.valid) writeFileSync(`${output}/result.json`, JSON.stringify(record, null, 2))
console.log(JSON.stringify({ loaded: used.size, missing: assessed.solution.unpackedItems.length, valid: assessed.validation.valid, errors: assessed.validation.errors.slice(0, 5), solver: record.solver }))
