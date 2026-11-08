// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { loadProgress } from './hi3d-load-progress'
import { buildPlan, scenarios } from './scenarios'
import { toContainer } from './priority-pack'

describe('loading-progress unloading obstruction', () => {
  for (const scenario of scenarios) {
    it(`${scenario.id}: loaded relations, reversible steps and correct final count`, () => {
      const plan = buildPlan(scenario, 'bulk'), final = loadProgress(plan, plan.loadOrder.length)
      expect(final.active.length).toBe(scenario.id === 'land' ? 3 : 7)
      expect(loadProgress(plan, 0).active).toEqual([])
      for (let step = 0; step <= plan.loadOrder.length; step++) {
        const progress = loadProgress(plan, step), loaded = new Set(plan.loadOrder.slice(0, step).map(p => p.item.id))
        const expected = plan.blocking.filter(row => loaded.has(row.itemId) && row.blockedBy.some(id => loaded.has(id)))
        expect(progress.active.map(row => row.itemId)).toEqual(expected.map(row => row.itemId))
        for (const row of progress.active) expect(row.blockedBy.every(id => loaded.has(id))).toBe(true)
      }
      for (const event of final.events) expect(loadProgress(plan, event.step).active.length - loadProgress(plan, event.step - 1).active.length).toBe(event.itemIds.length)
      expect(loadProgress(plan, final.events[0].step - 1).active).toEqual([])
      const priority = buildPlan(scenario, 'priority')
      expect(loadProgress(priority, priority.loadOrder.length).events).toEqual([])
    })
  }
  it('waits for both pieces and counts a target with two blockers once', () => {
    const plan = buildPlan(scenarios[0], 'bulk'), ids = plan.loadOrder.slice(0, 3).map(p => p.item.id)
    const test = { loadOrder: plan.loadOrder.slice(0, 3), blocking: [{ itemId: ids[1], stopId: 'A', blockedBy: [ids[0], ids[2]] }] }
    expect(loadProgress(test, 1).active).toEqual([])
    expect(loadProgress(test, 2).active[0].blockedBy).toEqual([ids[0]])
    expect(loadProgress(test, 3).active).toHaveLength(1)
    expect(loadProgress(test, 3).events).toEqual([{ step: 2, itemIds: [ids[1]] }])
  })
  it('uses visible cargo for center of gravity, volume and weight', () => {
    const plan = buildPlan(scenarios[0], 'bulk'), empty = toContainer(plan, new Set())
    expect(empty.totalWeight).toBe(0); expect(empty.volumeUtilization).toBe(0); expect(empty.centerOfGravity).toBeUndefined()
    const first = plan.loadOrder[0], one = toContainer(plan, new Set([first.item.id]))
    expect(one.totalWeight).toBe(first.item.weight)
    expect(one.centerOfGravity?.x).toBeCloseTo(first.position.x + first.actualDimensions.length / 2)
    expect(one.unloadingDoor).toBe('x-max')
  })
})
