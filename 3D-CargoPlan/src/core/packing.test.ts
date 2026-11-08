// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import type { CargoItem, OptimizationConfig, PlacedItem } from '../types/packing'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, orientationsFor, updateContainer } from './packing-utils'
import { createEmptyContainer, packInOrder } from './greedy-algorithm'
import { DEFAULT_CONFIG, optimize, optimizeMultiple } from './optimizer'
import { validateSolution } from './validation'
import { orderCrossover } from './genetic-algorithm'
import { createPackingSolution } from './solution-builder'

function cargo(id: string, length = 10, width = 10, height = 10, weight = 10): CargoItem {
  return { id, name: id, category: 'crate', dimensions: { length, width, height }, weight, quantity: 1, allowedOrientations: ['standing'], canStackOnTop: true, canOffsetStack: false, hasGlass: false, colorTag: 'blue', rawData: {} }
}
const config = (extra: Partial<OptimizationConfig> = {}): OptimizationConfig => ({ ...DEFAULT_CONFIG, containerDimensions: { length: 10, width: 10, height: 30 }, containerMaxWeight: 100, algorithm: 'greedy', timeLimit: 500, ...extra })
const placed = (item: CargoItem, z: number): PlacedItem => ({ item, position: { x: 0, y: 0, z }, orientation: 'standing', rotation: 0, actualDimensions: { ...item.dimensions } })

describe('physical packing rules', () => {
  it('covers all six orientations with consistent vertical axes', () => {
    const item = { ...cargo('axis', 2, 3, 5), allowedOrientations: ['standing', 'lying', 'flat'] as CargoItem['allowedOrientations'] }
    expect(new Set(orientationsFor(item).map(v => Object.values(v.dimensions).join('/'))).size).toBe(6)
    expect(calculateActualDimensions(item.dimensions, 'lying', 0)).toEqual({ length: 2, width: 5, height: 3 })
    expect(calculateActualDimensions(item.dimensions, 'flat', 90)).toEqual({ length: 5, width: 3, height: 2 })
  })
  it('uses a permitted rotation when it is the only way to fit', () => {
    const item = { ...cargo('rotate', 10, 20, 30), allowedOrientations: ['lying'] as CargoItem['allowedOrientations'] }
    const solution = optimize([item], config({ containerDimensions: { length: 30, width: 10, height: 20 } }))
    expect(solution.unpackedItems).toHaveLength(0)
    expect(solution.containers[0].items[0].rotation).toBe(90)
    expect(solution.validation?.valid).toBe(true)
  })
  it('respects source-specific flat/standing axes and flat pile limits', () => {
    const window = { ...cargo('window', 13, 15, 1), allowedOrientations: ['flat'] as CargoItem['allowedOrientations'], orientationVerticalAxes: { standing: 'length', lying: 'width', flat: 'height' } as CargoItem['orientationVerticalAxes'], constraints: { orientationRules: { flat: { maxStackCount: 1 } } } }
    const result = optimize([{ ...window, quantity: 3 }], config({ containerDimensions: { length: 13, width: 15, height: 10 } }))
    expect(result.containers[0].items[0].actualDimensions.height).toBe(1)
    expect(result.totalContainers).toBe(2)
    expect(result.validation?.valid).toBe(true)
  })
  it('rejects forbidden direction, negative coordinates, floating and overweight items', () => {
    const c = createEmptyContainer(0, config({ containerMaxWeight: 15 })), first = cargo('a')
    c.items.push(placed(first, 0)); updateContainer(c)
    expect(canPlaceAt(cargo('b'), { x: 0, y: 0, z: 10 }, 'standing', 0, c)).toBe(false)
    expect(canPlaceAt(cargo('light', 10, 10, 10, 1), { x: 0, y: 0, z: 11 }, 'standing', 0, c)).toBe(false)
    expect(canPlaceAt(first, { x: -1, y: 0, z: 0 }, 'standing', 0, createEmptyContainer(0, config()))).toBe(false)
    expect(canPlaceAt({ ...first, forbiddenOrientations: ['standing'] }, { x: 0, y: 0, z: 0 }, 'standing', 0, createEmptyContainer(0, config()))).toBe(false)
  })
  it('transfers load through intermediate layers and respects a zero top-load limit', () => {
    const base = { ...cargo('base'), maxStackWeight: 15 }, middle = cargo('mid'), top = cargo('top')
    const c = createEmptyContainer(0, config()); c.items.push(placed(base, 0), placed(middle, 10)); updateContainer(c)
    expect(canPlaceAt(top, { x: 0, y: 0, z: 20 }, 'standing', 0, c)).toBe(false)
    expect(analyzeStacking([...c.items, placed(top, 20)]).topLoads[0]).toBe(20)
    expect(analyzeStacking([placed({ ...base, maxStackWeight: 0 }, 0), placed(middle, 10)]).errors.some(e => e.includes('载荷'))).toBe(true)
  })
  it('enforces cumulative stack count, category permission and floor-only restrictions', () => {
    expect(analyzeStacking([placed({ ...cargo('base'), maxStackCount: 1 }, 0), placed(cargo('mid'), 10), placed(cargo('top'), 20)]).errors.some(e => e.includes('件数'))).toBe(true)
    const c = createEmptyContainer(0, config()); c.items.push(placed({ ...cargo('glass'), canStackOnTop: false }, 0)); updateContainer(c)
    expect(canPlaceAt(cargo('top'), { x: 0, y: 0, z: 10 }, 'standing', 0, c)).toBe(false)
    c.items[0].item = { ...cargo('base'), stackableWith: ['other'] }
    expect(canPlaceAt(cargo('top'), { x: 0, y: 0, z: 10 }, 'standing', 0, c)).toBe(false)
    expect(canPlaceAt({ ...cargo('floor'), constraints: { mustBeOnFloor: true } }, { x: 0, y: 0, z: 10 }, 'standing', 0, c)).toBe(false)
  })
  it('applies conditional load and individual-weight limits only in their orientation', () => {
    const base = { ...cargo('base'), constraints: { orientationRules: { standing: { maxStackWeight: 10, strictMaxStackWeight: true, maxSupportedItemWeight: 5 } } } }
    expect(analyzeStacking([placed(base, 0), placed(cargo('heavy', 10, 10, 10, 6), 10)]).errors.some(e => e.includes('单件'))).toBe(true)
    expect(analyzeStacking([placed(base, 0), placed(cargo('mid', 10, 10, 10, 5), 10), placed(cargo('top', 10, 10, 10, 5), 20)]).errors.some(e => e.includes('载荷'))).toBe(true)
  })
  it('matches self-only stacking by source row instead of generic category', () => {
    const base = { ...cargo('base'), stackableWith: ['@self'], rawData: { _sourceSheet: 's', _sourceRow: 4 } }
    const different = { ...cargo('different'), rawData: { _sourceSheet: 's', _sourceRow: 5 } }
    expect(analyzeStacking([placed(base, 0), placed(different, 10)]).errors.some(e => e.includes('承托'))).toBe(true)
    expect(analyzeStacking([placed(base, 0), placed({ ...different, rawData: { _sourceSheet: 's', _sourceRow: 4 } }, 10)]).errors).toEqual([])
  })
  it('requires largest face down only for direct supported contacts, including cached placement checks', () => {
    const base = { ...cargo('base', 10, 10, 10), constraints: { supportedItemsLargestFaceDown: true } }
    const upper = { ...cargo('upper', 4, 6, 2), allowedOrientations: ['standing', 'lying'] as CargoItem['allowedOrientations'] }
    const container = createEmptyContainer(0, config()); container.items.push(placed(base, 0)); updateContainer(container)
    expect(canPlaceAt(upper, { x: 0, y: 0, z: 10 }, 'standing', 0, container)).toBe(true)
    expect(canPlaceAt(upper, { x: 0, y: 0, z: 10 }, 'lying', 0, container)).toBe(false)
    const wrongUpper = { ...placed(upper, 10), orientation: 'lying' as const, actualDimensions: calculateActualDimensions(upper.dimensions, 'lying', 0) }
    expect(analyzeStacking([placed(base, 0), wrongUpper]).errors.some(e => e.includes('最大面积面'))).toBe(true)
    // The bottom box's rule applies to its direct support, not every higher layer.
    const mid = { ...cargo('mid', 10, 10, 2), constraints: undefined }
    const high = { ...wrongUpper, position: { x: 0, y: 0, z: 12 } }
    expect(analyzeStacking([placed(base, 0), placed(mid, 10), high]).errors).toEqual([])
    const equalFace = cargo('cube', 2, 2, 2)
    expect(canPlaceAt(equalFace, { x: 0, y: 0, z: 10 }, 'standing', 0, container)).toBe(true)
    const fake = createPackingSolution([{ ...container, items: [placed({ ...base, constraints: undefined }, 0), wrongUpper] }], [], 'audit-test', 0, 0)
    expect(validateSolution(fake, [base, upper]).errors.some(e => e.includes('最大面积面'))).toBe(true)
  })
})

describe('solution identity and independent audit', () => {
  it('expands quantities and accounts for oversized and review-only units', () => {
    const items = [{ ...cargo('batch'), quantity: 3 }, cargo('huge', 100), { ...cargo('review'), constraints: { requiresManualReview: ['宽面朝下需复核'] } }]
    const solution = optimize(items, config())
    expect(solution.totalItems).toBe(5); expect(solution.stats?.placedItems).toBe(3); expect(solution.unpackedItems).toHaveLength(2)
    expect(validateSolution(solution, items).valid).toBe(true)
    expect(solution.validation?.warnings.some(w => w.includes('人工复核'))).toBe(true)
  })
  it('detects duplicate, missing, collision, changed dimensions and tampered statistics', () => {
    const items = [cargo('a'), cargo('b')], good = optimize(items, config())
    const duplicate = structuredClone(good); duplicate.unpackedItems.push(items[0])
    expect(validateSolution(duplicate, items).errors.some(e => e.includes('重复'))).toBe(true)
    const missing = structuredClone(good); missing.containers[0].items.pop()
    expect(validateSolution(missing, items).errors.some(e => e.includes('遗漏'))).toBe(true)
    const collision = structuredClone(good); collision.containers[0].items[1].position.z = 0
    expect(validateSolution(collision, items).errors.some(e => e.includes('碰撞'))).toBe(true)
    const dimensions = structuredClone(good); dimensions.containers[0].items[0].actualDimensions.length = 9
    expect(validateSolution(dimensions, items).errors.some(e => e.includes('实际尺寸'))).toBe(true)
    const stats = structuredClone(good); stats.containers[0].totalWeight = 1
    expect(validateSolution(stats, items).errors.some(e => e.includes('总重量'))).toBe(true)
  })
  it('checks original stacking limits even if the result item removes them', () => {
    const items = [{ ...cargo('a'), maxStackWeight: 0 }, cargo('b')], solution = optimize(items, config())
    const tampered = structuredClone(solution)
    tampered.containers[0].items.push({ ...placed({ ...items[0], maxStackWeight: undefined }, 10), item: items[1] })
    tampered.containers[0].items[0].item.maxStackWeight = undefined
    expect(validateSolution(tampered, items).valid).toBe(false)
  })
  it('keeps unknown-weight items visible and warns about weight uncertainty', () => {
    const result = optimize([cargo('unknown', 10, 10, 10, 0)], config())
    expect(result.stats?.placedItems).toBe(1); expect(result.validation?.valid).toBe(true)
    expect(result.validation?.warnings.some(w => w.includes('0 kg'))).toBe(true)
  })
})

describe('bounded search algorithms', () => {
  it('decoder preserves search order instead of silently re-sorting', () => {
    const cfg = config({ containerDimensions: { length: 10, width: 1, height: 1 } })
    const a = cargo('a', 6, 1, 1), b = cargo('b', 6, 1, 1), c = cargo('c', 4, 1, 1), d = cargo('d', 4, 1, 1)
    expect(packInOrder([c, d, a, b], cfg).totalContainers).toBe(3)
    expect(packInOrder([a, c, b, d], cfg).totalContainers).toBe(2)
    expect(orderCrossover([a, b, c, d], [d, c, b, a], 1, 2).map(i => i.id).sort()).toEqual(['a', 'b', 'c', 'd'])
  })
  it.each(['greedy', 'genetic', 'tabu', 'ant-colony', 'branch-bound', 'hybrid'] as const)('%s returns a complete, physically valid accounting', algorithm => {
    const items = [cargo('a', 6, 1, 1), cargo('b', 6, 1, 1), cargo('c', 4, 1, 1), cargo('d', 4, 1, 1)]
    const solution = optimize(items, config({ algorithm, containerDimensions: { length: 10, width: 1, height: 1 }, populationSize: 4, generations: 3 }))
    expect(solution.validation?.errors).toEqual([]); expect(solution.totalContainers).toBe(2); expect(solution.unpackedItems).toHaveLength(0)
    expect(solution.algorithm.toLowerCase()).toContain(algorithm === 'tabu' ? 'tabu' : algorithm)
  })
  it('uses one total comparison budget and accounts for timeout units', async () => {
    const items = Array.from({ length: 30 }, (_, i) => cargo(`item-${i}`)), progress: number[] = []
    const start = Date.now(), solutions = await optimizeMultiple(items, config({ timeLimit: 0 }), p => progress.push(p.progress))
    expect(Date.now() - start).toBeLessThan(300)
    expect(solutions).toHaveLength(1); expect(solutions[0].unpackedItems).toHaveLength(30); expect(solutions[0].validation?.valid).toBe(true)
    expect(progress.at(-1)).toBe(100)
  })
  it('branches beyond the FFD incumbent when the volume lower bound is not reached', () => {
    const items = [6, 5, 3, 2, 2, 2].map((size, i) => cargo(`branch-${i}`, size, 1, 1)), cfg = config({ containerDimensions: { length: 10, width: 1, height: 1 }, timeLimit: 1000 })
    expect(optimize(items, cfg).totalContainers).toBe(3)
    const bounded = optimize(items, { ...cfg, algorithm: 'branch-bound' })
    expect(bounded.totalContainers).toBe(2)
    expect(bounded.validation?.valid).toBe(true)
    expect(bounded.searchMode).toBe('bounded-search')
  })
})
