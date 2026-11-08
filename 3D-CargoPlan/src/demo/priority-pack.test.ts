// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import type { CargoItem } from '../types/packing'
import { buildPlan, landStops, scenarios, seaStops } from './scenarios'
import { packPlan, unloadOrder, type DemoPiece, type DemoVehicle } from './priority-pack'

const box = (id: string, length: number, stopId: string): DemoPiece => ({
  stopId,
  item: {
    id, name: id, category: 'box', dimensions: { length, width: 100, height: 100 }, weight: length, quantity: 1,
    allowedOrientations: ['standing'], canStackOnTop: false, hasGlass: false, canOffsetStack: false, colorTag: '', rawData: {},
  } satisfies CargoItem,
})

const vehicle: DemoVehicle = {
  id: 'test', name: 'test', dimensions: { length: 2500, width: 150, height: 500 }, maxWeightKg: 10000, doorLabel: 'door',
}

describe('priority packing', () => {
  it('keeps the first stop beside the door and reports no cross-stop blocks', () => {
    const stops = [
      { id: 'A', name: 'A', priority: 1, color: '#111111' },
      { id: 'C', name: 'C', priority: 3, color: '#333333' },
    ]
    const plan = packPlan(vehicle, [box('late', 100, 'C'), box('early', 2000, 'A')], stops, 'priority')
    expect(plan.unpacked).toEqual([])
    expect(plan.crossStopBlocks).toBe(0)
    const early = plan.placed.find((piece) => piece.item.id === 'early')!
    const late = plan.placed.find((piece) => piece.item.id === 'late')!
    expect(early.position.x).toBeGreaterThan(late.position.x + late.actualDimensions.length - 1)
    expect(plan.loadOrder[0].item.id).toBe('late')
    expect(unloadOrder(plan, 'A').map((piece) => piece.item.id)).toEqual(['early'])
  })

  it('shows a later stop sitting in front of an earlier stop when groups are ignored', () => {
    const stops = [
      { id: 'A', name: 'A', priority: 1, color: '#111111' },
      { id: 'C', name: 'C', priority: 3, color: '#333333' },
    ]
    const plan = packPlan(vehicle, [box('late', 100, 'C'), box('early', 2000, 'A')], stops, 'bulk')
    expect(plan.crossStopBlocks).toBeGreaterThan(0)
  })

  it('loads every Iraq sample piece for both scenarios when grouped by priority', () => {
    for (const scenario of scenarios) {
      const plan = buildPlan(scenario, 'priority')
      expect(plan.unpacked, scenario.id).toEqual([])
      expect(plan.placed).toHaveLength(scenario.pieces.length)
      expect(plan.crossStopBlocks, scenario.id).toBe(0)
      const ordered = [...scenario.stops].sort((a, b) => a.priority - b.priority)
      for (let i = 0; i < ordered.length - 1; i += 1) {
        const sooner = plan.placed.filter((piece) => piece.stopId === ordered[i].id)
        const later = plan.placed.filter((piece) => piece.stopId === ordered[i + 1].id)
        const soonerMin = Math.min(...sooner.map((piece) => piece.position.x))
        const laterMax = Math.max(...later.map((piece) => piece.position.x + piece.actualDimensions.length))
        expect(soonerMin, `${scenario.id}:${ordered[i].id}`).toBeGreaterThanOrEqual(laterMax - 0.5)
      }
    }
    expect(landStops).toHaveLength(3)
    expect(seaStops).toHaveLength(3)
    expect(buildPlan(scenarios[0], 'bulk').crossStopBlocks).toBeGreaterThan(0)
    expect(buildPlan(scenarios[1], 'bulk').crossStopBlocks).toBeGreaterThan(0)
  })

  it('leaves a gap between groups and stops when the payload is used up', () => {
    const stops = [
      { id: 'A', name: 'A', priority: 1, color: '#111111' },
      { id: 'C', name: 'C', priority: 3, color: '#333333' },
    ]
    const pieces = [box('late', 100, 'C'), box('early', 400, 'A')]
    const gapped = packPlan(vehicle, pieces, stops, 'priority', { groupGapMm: 300 })
    const early = gapped.placed.find((piece) => piece.item.id === 'early')!
    const late = gapped.placed.find((piece) => piece.item.id === 'late')!
    expect(early.position.x).toBeGreaterThanOrEqual(late.position.x + late.actualDimensions.length + 300 - 0.5)
    const limited = packPlan({ ...vehicle, maxWeightKg: 100 }, pieces, stops, 'priority', { respectWeight: true })
    expect(limited.placed).toHaveLength(1)
    expect(limited.totalWeightKg).toBeLessThanOrEqual(100)
    expect(limited.unpacked.some((piece) => piece.reason === '超过当前载重')).toBe(true)
  })
})
