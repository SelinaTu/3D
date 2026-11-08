// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import report from '../../output/reports/iraq-villa-current-best.plan.json'
import native from '../../data/optimization/v3-r2-delivery/current-best.json'
import { requireIraqBaseline } from './iraq-baseline'
import { generateRouteProblem } from '../core/multistop/scenarios'
import { solveRoute } from '../core/multistop/engine'
import { auditSimulation } from '../core/multistop/replay'
import { DEFAULT_HANDLING } from '../core/multistop/access'
import type { Container } from '../types/packing'

describe('HTML 与 APP 的伊拉克完整多站演示', () => {
  it('共享 11 柜 / 1371 件，按逐件身份校对原生冻结解，不依赖不同的柜号排序', () => {
    const solution = requireIraqBaseline(report)
    const placements = (containers: Container[]) => Object.fromEntries(containers.flatMap(c => c.items.map(p => [p.item.id, { position: p.position, dimensions: p.actualDimensions, orientation: p.orientation, rotation: p.rotation }])))
    expect(placements(solution.containers)).toEqual(placements(native.solution.containers as Container[]))
    expect(solution.containers[0].items).toHaveLength(93)
    expect(solution.containers[9].items).toHaveLength(238)
  })
  for (const index of [0, 9]) it(`完整第 ${index + 1} 柜生成五站并按工人可达求解，原摆放与货物不丢失`, () => {
    const source = structuredClone(requireIraqBaseline(report).containers[index])
    source.handlingAccess = { ...DEFAULT_HANDLING }; source.routeDoors = ['x-max']
    const before = structuredClone(source)
    const problem = generateRouteProblem(source, { stopCount: 5, seed: 20261030, mode: 'feasible', door: 'x-max' })
    problem.handling = { ...DEFAULT_HANDLING }
    const result = solveRoute(problem, undefined, { perStopTimeLimitMs: 3000, repackInitial: true })
    expect(problem.initial.items).toHaveLength(index === 0 ? 93 : 238)
    expect(result.stops.every(s => s.unloaded.length > 0 && s.loaded.length > 0 && !s.blockedUnload.length && !s.failedPickup.length && !s.cancelledDelivery.length)).toBe(true)
    expect(auditSimulation(result)).toEqual([])
    expect(source).toEqual(before)
  }, 30000)
  it('拒绝少件或重复件基线，不能静默退回八件示例', () => {
    const damaged = structuredClone(report)
    damaged.solution.containers[0].items.pop()
    expect(() => requireIraqBaseline(damaged)).toThrow('1371')
  })
})
