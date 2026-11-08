// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { createRouteDemoContainer } from './route-demo'
import { generateRouteProblem } from '../core/multistop/scenarios'
import { solveRoute } from '../core/multistop/engine'
import { auditSimulation } from '../core/multistop/replay'
import { DEFAULT_HANDLING } from '../core/multistop/access'
import { buildPlayback } from '../core/multistop/playback'

describe('独立自动出题演示', () => {
  for (const seed of [20261030, 42, 918]) for (const repackInitial of [false, true]) it(`种子 ${seed} / 起点重排 ${repackInitial}：五站人员作业完整求解、重放，不依赖用户装配`, () => {
    const source = createRouteDemoContainer(), before = structuredClone(source)
    const problem = generateRouteProblem(source, { stopCount: 5, seed, mode: 'feasible', door: 'x-max' })
    problem.handling = { ...DEFAULT_HANDLING }
    const result = solveRoute(problem, undefined, { perStopTimeLimitMs: 2000, repackInitial })
    expect(result.stops).toHaveLength(5)
    expect(result.stops.every(s => !s.failedPickup.length && !s.blockedUnload.length && !s.cancelledDelivery.length)).toBe(true)
    expect(result.stops.slice(0, 4).every(s => s.unloaded.length > 0 && s.loaded.length > 0)).toBe(true)
    expect(result.stops.at(-1)?.after.items).toHaveLength(0)
    expect(auditSimulation(result)).toEqual([])
    expect(buildPlayback(result).some(s => s.operation?.action === 'unload')).toBe(true)
    expect(buildPlayback(result).some(s => s.operation?.action === 'pickup')).toBe(true)
    expect(source).toEqual(before)
  })
  it('种子可复现，重复创建不共享可变库存', () => {
    const a = createRouteDemoContainer(), b = createRouteDemoContainer()
    const options = { stopCount: 4, seed: 123, mode: 'feasible' as const, door: 'x-max' as const }
    expect(generateRouteProblem(a, options)).toEqual(generateRouteProblem(b, options))
    a.items[0].item.dimensions.length = 1
    expect(b.items[0].item.dimensions.length).toBe(340)
  })
})
