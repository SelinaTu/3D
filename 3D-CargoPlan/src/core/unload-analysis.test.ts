// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import type { CargoItem, PlacedItem } from '../types/packing'
import { analyzeUnloading } from './unload-analysis'
import { createEmptyContainer, packInOrder } from './greedy-algorithm'
import { compareSolutions } from './evaluator'
import { DEFAULT_CONFIG, optimize } from './optimizer'
import { validateSolution } from './validation'
import { validateRequest } from '../server/input-validation'
import { canPlaceAt, updateContainer } from './packing-utils'

const item = (id: string, stop: number, length = 4): CargoItem => ({ id, name: id, category: '箱', dimensions: { length, width: 4, height: 4 }, weight: 1, quantity: 1, unloadStop: stop, allowedOrientations: ['standing'], canStackOnTop: true, canOffsetStack: false, hasGlass: false, colorTag: '', rawData: {} })
const config = { ...DEFAULT_CONFIG, containerDimensions: { length: 10, width: 4, height: 8 }, containerMaxWeight: 100, unloadingDoor: 'x-min' as const, algorithm: 'greedy' as const, timeLimit: 1000 }
const place = (cargo: CargoItem, x: number, z = 0): PlacedItem => ({ item: cargo, position: { x, y: 0, z }, orientation: 'standing', rotation: 0, actualDimensions: cargo.dimensions })

describe('指定站点的卸货遮挡分析', () => {
  it('区分两侧车门、同站货物及直接支撑', () => {
    const early = item('early', 1), late = item('late', 3)
    const container = createEmptyContainer(0, config)
    container.items = [place(late, 0), place(early, 4)]
    expect(analyzeUnloading([container])?.blockers).toMatchObject([{ itemId: 'early', blockedById: 'late', reasons: ['door-projection'] }])
    expect(analyzeUnloading([{ ...container, unloadingDoor: 'x-max' }])?.blockerPairCount).toBe(0)
    container.items = [place(early, 0), place(late, 0, 4)]
    expect(analyzeUnloading([container])?.blockers).toMatchObject([{ itemId: 'early', blockedById: 'late', reasons: ['supports-blocker'] }])
    container.items[1].item = { ...late, unloadStop: 1 }
    expect(analyzeUnloading([container])?.blockerPairCount).toBe(0)
  })
  it('在车辆数相同时优先选遮挡更少的候选', () => {
    const early = item('early', 1, 4), late = item('late', 2, 6)
    const blocked = packInOrder([late, early], { ...config, containerDimensions: { length: 10, width: 4, height: 4 } })
    const result = optimize([late, early], { ...config, containerDimensions: { length: 10, width: 4, height: 4 } })
    expect(blocked.unloadAnalysis?.blockerPairCount).toBe(1)
    expect(result.totalContainers).toBe(1)
    expect(result.unloadAnalysis?.blockerPairCount).toBe(0)
    expect(result.validation?.valid).toBe(true)
    expect(compareSolutions(result, blocked)).toBeLessThan(0)
    expect(compareSolutions({ ...result, totalContainers: 2 }, blocked)).toBeGreaterThan(0)
    const forged = structuredClone(result)
    forged.unloadAnalysis!.blockerPairCount = 100
    expect(validateSolution(forged, [late, early], config).errors.some(e => e.includes('遮挡分析'))).toBe(true)
  })
  it('启用站点分析时不猜测缺失或非法站点', () => {
    const missing = { ...item('a', 1), unloadStop: undefined }
    expect(() => optimize([missing], config)).toThrow('每件货物')
    expect(() => validateRequest({ items: [missing], config })).toThrow('每件货物')
    const withoutStops = optimize([missing], { ...config, unloadingDoor: undefined })
    expect(validateSolution(withoutStops, [missing], config).errors.join(' ')).toContain('每件货物')
    expect(() => validateRequest({ items: [item('a', 0)], config })).toThrow('正整数')
  })
  it('禁止跨站直接叠放：候选位置与独立验收均执行，允许同站叠放', () => {
    const early = item('early', 1), late = item('late', 2), same = item('same', 1)
    const restricted = { ...config, containerDimensions: { length: 4, width: 4, height: 8 }, preventCrossStopStacking: true }
    const container = createEmptyContainer(0, restricted)
    container.items.push(place(early, 0)); updateContainer(container)
    expect(canPlaceAt(late, { x: 0, y: 0, z: 4 }, 'standing', 0, container)).toBe(false)
    expect(canPlaceAt(same, { x: 0, y: 0, z: 4 }, 'standing', 0, container)).toBe(true)
    const result = optimize([early, late], restricted)
    expect(result.totalContainers).toBe(2)
    expect(result.validation?.valid).toBe(true)
    const unrestricted = optimize([early, late], { ...restricted, preventCrossStopStacking: false })
    expect(unrestricted.totalContainers).toBe(1)
    expect(validateSolution(unrestricted, [early, late], restricted).errors.join(' ')).toContain('不允许不同卸货站组叠放')
    expect(() => validateRequest({ items: [early], config: { preventCrossStopStacking: true } })).toThrow('须先启用')
  })
})
