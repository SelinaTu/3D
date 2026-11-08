// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import type { CargoItem, Container, OptimizationConfig, PackingSolution } from '../types/packing'
import { createPackingSolution } from './solution-builder'
import { assessResearchCandidate, canonicalResearchSolution, compareResearchMetrics, isResearchImprovement, physicalLayoutHash } from './research-metrics'

const config: OptimizationConfig = { containerDimensions: { length: 100, width: 100, height: 100 }, containerMaxWeight: 1000, loadingProfile: 'custom', verticalSupport: 'none', algorithm: 'greedy', weights: { containerCount: 1, volumeUtilization: 1, weightBalance: 1, stabilityPenalty: 1 } }
const item = (id: string, length = 10): CargoItem => ({ id, name: id, category: 'box', dimensions: { length, width: 10, height: 10 }, weight: 1, quantity: 1, allowedOrientations: ['standing'], canStackOnTop: true, hasGlass: false, canOffsetStack: false, colorTag: '', rawData: {} })
function solution(groups: CargoItem[][]): PackingSolution {
  const containers: Container[] = groups.map((items, i) => ({ id: `original-${i}`, dimensions: { ...config.containerDimensions }, maxWeight: config.containerMaxWeight, totalWeight: 0, volumeUtilization: 0, weightUtilization: 0, items: items.map((cargo, j) => ({ item: cargo, position: { x: j * 10, y: 0, z: 0 }, orientation: 'standing', rotation: 0, actualDimensions: { ...cargo.dimensions } })) }))
  return createPackingSolution(containers, [], 'fixture', 0, 0)
}
function byCounts(items: CargoItem[], counts: number[]) { let i = 0; return solution(counts.map(count => items.slice(i, i += count))) }

describe('calibrated research objective without running an optimizer', () => {
  it('prefers valid ten containers even when its tail is larger than the eleven-container tail', () => {
    const items = [...Array.from({ length: 10 }, (_, i) => item(`big-${i}`)), item('small', 1)]
    const eleven = assessResearchCandidate(solution(items.map(i => [i])), items, config)
    const ten = assessResearchCandidate(solution([[items[0], items[10]], ...items.slice(1, 10).map(i => [i])]), items, config)
    expect(eleven.metrics.eligible).toBe(true); expect(ten.metrics.eligible).toBe(true)
    expect(ten.metrics.tailSolidVolumeMm3).toBeGreaterThan(eleven.metrics.tailSolidVolumeMm3)
    expect(compareResearchMetrics(ten.metrics, eleven.metrics)).toBeLessThan(0)
  })
  it('minimizes the sorted tail at eleven containers before other density metrics', () => {
    const cubes = Array.from({ length: 31 }, (_, i) => item(`cube-${i}`)), small = item('small', 1), items = [...cubes, small]
    const beforeGroups = Array.from({ length: 10 }, (_, i) => cubes.slice(i * 3, i * 3 + 3)); beforeGroups.push([cubes[30], small])
    const afterGroups = [[...cubes.slice(0, 3), cubes[30]], ...Array.from({ length: 9 }, (_, i) => cubes.slice((i + 1) * 3, (i + 2) * 3)), [small]]
    const before = assessResearchCandidate(solution(beforeGroups), items, config), after = assessResearchCandidate(solution(afterGroups), items, config)
    expect(after.metrics.eligible).toBe(true); expect(after.metrics.tailSolidVolumeMm3).toBe(100)
    expect(isResearchImprovement(after.metrics, before.metrics)).toBe(true)
  })
  it('uses the first ten minimum solid utilization only after an equal eleven-container tail', () => {
    const items = Array.from({ length: 31 }, (_, i) => item(`cube-${i}`))
    const before = assessResearchCandidate(byCounts(items, [5, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1]), items, config)
    const after = assessResearchCandidate(byCounts(items, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1]), items, config)
    expect(after.metrics.tailSolidVolumeMm3).toBe(before.metrics.tailSolidVolumeMm3)
    expect(after.metrics.front10MinimumSolidUtilization).toBeGreaterThan(before.metrics.front10MinimumSolidUtilization!)
    expect(isResearchImprovement(after.metrics, before.metrics)).toBe(true)
  })
  it('does not count renaming or sorting as an actual layout or allocation improvement', () => {
    const items = Array.from({ length: 11 }, (_, i) => item(`cube-${i}`)), before = assessResearchCandidate(solution(items.map(i => [i])), items, config)
    const renamed = { ...before.solution, containers: [...before.solution.containers].reverse().map((c, i) => ({ ...c, id: `new-${i}` })) }
    const after = assessResearchCandidate(renamed, items, config)
    expect(after.metrics.physicalLayoutSha256).toBe(before.metrics.physicalLayoutSha256)
    expect(after.metrics.allocationSha256).toBe(before.metrics.allocationSha256)
    expect(isResearchImprovement(after.metrics, before.metrics)).toBe(false)
    expect(physicalLayoutHash(canonicalResearchSolution(after))).toBe(before.metrics.physicalLayoutSha256)
  })
  it('rejects fake-complete collision and missing-item results despite their lower count', () => {
    const items = [item('a'), item('b')], good = assessResearchCandidate(solution(items.map(i => [i])), items, config)
    const collision = solution([items]); collision.containers[0].items[1].position.x = 0
    const bad = assessResearchCandidate(collision, items, config), missing = assessResearchCandidate(solution([[items[0]]]), items, config)
    expect(bad.metrics.complete).toBe(true); expect(bad.metrics.eligible).toBe(false)
    expect(missing.metrics.eligible).toBe(false)
    expect(compareResearchMetrics(bad.metrics, good.metrics)).toBeGreaterThan(0)
    expect(compareResearchMetrics(missing.metrics, good.metrics)).toBeGreaterThan(0)
  })
  it('reports material, outer-envelope sum and enclosing bounds as distinct metrics', () => {
    const hollow: CargoItem = { ...item('frame'), cavity: { dimensions: { length: 5, width: 5, height: 10 }, offset: { x: 2.5, y: 2.5, z: 0 }, allowedSourceSheets: ['辅材'] } }
    const assessed = assessResearchCandidate(solution([[hollow]]), [hollow], config), metrics = assessed.metrics.containers[0]
    expect(assessed.metrics.eligible).toBe(true)
    expect(metrics.solidVolumeMm3).toBe(750); expect(metrics.outerEnvelopeSumMm3).toBe(1000); expect(metrics.enclosingBoxVolumeMm3).toBe(1000)
  })
  it('requires validation against the requested configuration', () => {
    const items = [item('a')], wrong = solution([[items[0]]]); wrong.containers[0].maxWeight = 9999
    expect(assessResearchCandidate(wrong, items, config).metrics.eligible).toBe(false)
  })
})
