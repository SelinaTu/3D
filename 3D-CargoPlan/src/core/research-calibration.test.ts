// #created 11/08/2026
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CargoItem, OptimizationConfig } from '../types/packing'
import { loadResearchCalibration, assertResearchCalibration, researchFileHash, compareResearchWithPdf } from './research-calibration'
import { assessResearchCandidate } from './research-metrics'
import { createPackingSolution } from './solution-builder'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'packing-research-gate-')); roots.push(root)
  const item: CargoItem = { id: 'a', name: 'a', category: 'box', dimensions: { length: 10, width: 10, height: 10 }, weight: 1, quantity: 1, allowedOrientations: ['standing'], canStackOnTop: false, canOffsetStack: false, hasGlass: false, colorTag: '', rawData: {} }
  const config: OptimizationConfig = { containerDimensions: { length: 100, width: 100, height: 100 }, containerMaxWeight: 100, algorithm: 'hybrid', loadingProfile: 'custom', verticalSupport: 'none', weights: { containerCount: 1, volumeUtilization: 1, weightBalance: 1, stabilityPenalty: 1 } }
  writeFileSync(join(root, 'manifest.json'), JSON.stringify([item])); writeFileSync(join(root, 'source.txt'), 'test-source')
  const manifest = { path: 'manifest.json', sha256: researchFileHash(join(root, 'manifest.json')) }, sourceFiles = [{ path: 'source.txt', sha256: researchFileHash(join(root, 'source.txt')) }]
  const audit = { schemaVersion: 1, status: 'passed', checks: { allAssertionsPassed: true }, manifest, sourceFiles, totals: { totalItems: 1 }, containers: [{ containerNumber: 1, materialModelVolumeMm3: 1000 }], rows: [{ containerNumber: 1, normalizedIds: ['a'] }] }
  writeFileSync(join(root, 'audit.json'), JSON.stringify(audit))
  const gate = { schemaVersion: 1, status: 'ready', auditPath: 'audit.json', manifest, sourceFiles, config, support: { gapMm: 0, mechanism: 'none', confirmed: true } }
  const save = () => writeFileSync(join(root, 'gate.json'), JSON.stringify(gate))
  save(); return { root, item, config, gate, audit, save }
}

describe('research calibration gate without search', () => {
  it('rejects pending calibration and unconfirmed support', () => {
    const f = fixture(); f.gate.status = 'pending-clarification'; f.save()
    expect(() => loadResearchCalibration('gate.json', f.root)).toThrow('校准阶段尚未完成')
    f.gate.status = 'ready'; f.gate.support.confirmed = false; f.save()
    expect(() => loadResearchCalibration('gate.json', f.root)).toThrow('已确认')
  })
  it('accepts a passed audit, records all hashes, and detects later source tampering', () => {
    const f = fixture(), context = loadResearchCalibration('gate.json', f.root)
    expect(context.calibrationHash).toMatch(/^[a-f0-9]{64}$/)
    expect(context.manifestSha256).toBe(f.gate.manifest.sha256)
    expect(() => assertResearchCalibration(context, [f.item], f.config)).not.toThrow()
    writeFileSync(join(f.root, 'source.txt'), 'modified')
    expect(() => assertResearchCalibration(context, [f.item], f.config)).toThrow('原始输入')
  })
  it('rejects manifest, audit and config changes rather than silently recalibrating', () => {
    const f = fixture(), context = loadResearchCalibration('gate.json', f.root)
    expect(() => assertResearchCalibration(context, [f.item], { ...f.config, containerMaxWeight: 999 })).toThrow('已偏离')
    writeFileSync(join(f.root, 'manifest.json'), JSON.stringify([{ ...f.item, weight: 2 }]))
    expect(() => loadResearchCalibration('gate.json', f.root)).toThrow('哈希不符')
    writeFileSync(join(f.root, 'manifest.json'), JSON.stringify([f.item]))
    writeFileSync(join(f.root, 'audit.json'), JSON.stringify({ ...f.audit, checks: { allAssertionsPassed: false } }))
    expect(() => loadResearchCalibration('gate.json', f.root)).toThrow('尚未全部通过')
  })
  it('accepts explicit PDF projection without inventing physical spacers', () => {
    const f = fixture(); f.gate.config.loadingProfile = 'villa-pdf'; f.gate.config.verticalSupport = 'pdf-clearance-projection'; f.gate.support = { gapMm: 5, mechanism: 'pdf-clearance-projection', confirmed: true }; f.save()
    const context = loadResearchCalibration('gate.json', f.root)
    expect(context.support.mechanism).toBe('pdf-clearance-projection')
    expect(context.support.gapMm).toBe(5)
    f.gate.config.verticalSupport = 'none'; f.save()
    expect(() => loadResearchCalibration('gate.json', f.root)).toThrow('verticalSupport')
  })
  it('uses the permutation-invariant PDF tail and rejects relabeling as consolidation', () => {
    const f = fixture(), context = loadResearchCalibration('gate.json', f.root)
    const c = { id: 'renamed', dimensions: f.config.containerDimensions, maxWeight: f.config.containerMaxWeight, totalWeight: 0, volumeUtilization: 0, weightUtilization: 0, items: [{ item: f.item, position: { x: 0, y: 0, z: 0 }, orientation: 'standing' as const, rotation: 0, actualDimensions: f.item.dimensions }] }
    const assessed = assessResearchCandidate(createPackingSolution([c], [], 'fixture', 0, 0), [f.item], f.config)
    expect(compareResearchWithPdf(assessed.metrics, context).allocationChanged).toBe(false)
    expect(compareResearchWithPdf(assessed.metrics, context).canClaimTailConsolidation).toBe(false)
    expect(JSON.parse(readFileSync(join(f.root, 'audit.json'), 'utf8')).status).toBe('passed')
  })
})
