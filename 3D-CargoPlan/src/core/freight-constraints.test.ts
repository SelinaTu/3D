// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import type { CargoItem } from '../types/packing'
import { DEFAULT_CONFIG, optimize } from './optimizer'
import { canPlaceAt, orientationsFor, updateContainer } from './packing-utils'
import { createEmptyContainer } from './greedy-algorithm'
import { validateSolution } from './validation'
import { validateRequest } from '../server/input-validation'
import { nestedInside } from './solid-geometry'

const cargo = (id: string): CargoItem => ({ id, name: id, category: '箱', dimensions: { length: 10, width: 10, height: 10 }, weight: 1, quantity: 1, allowedOrientations: ['standing'], canStackOnTop: false, canOffsetStack: false, hasGlass: false, colorTag: '', rawData: {} })
const config = { ...DEFAULT_CONFIG, algorithm: 'greedy' as const, containerDimensions: { length: 30, width: 10, height: 10 }, containerMaxWeight: 100, timeLimit: 1000 }

describe('通用货运约束', () => {
  it('货物限制水平旋转时，候选和独立验收均拒绝其他角度', () => {
    const item = { ...cargo('a'), constraints: { horizontalRotations: [90] as Array<0 | 90 | 180 | 270> } }
    expect(orientationsFor(item).map(v => v.rotation)).toEqual([90])
    const result = optimize([item], config)
    expect(result.containers[0].items[0].rotation).toBe(90)
    expect(result.validation?.valid).toBe(true)
    result.containers[0].items[0].rotation = 0
    expect(validateSolution(result, [item], config).errors.join(' ')).toContain('水平旋转')
  })
  it('只允许同组混装是双向容器约束，不同组必须拆柜', () => {
    const a = { ...cargo('a'), constraints: { mixGroup: '食品', onlySameMixGroup: true } }
    const b = { ...cargo('b'), constraints: { mixGroup: '建材' } }
    const c = { ...cargo('c'), constraints: { mixGroup: '食品' } }
    const result = optimize([a, b, c], config)
    expect(result.totalContainers).toBe(2)
    expect(result.validation?.valid).toBe(true)
    const first = createEmptyContainer(0, config)
    first.items.push({ item: b, position: { x: 0, y: 0, z: 0 }, orientation: 'standing', rotation: 0, actualDimensions: b.dimensions }); updateContainer(first)
    expect(canPlaceAt(a, { x: 10, y: 0, z: 0 }, 'standing', 0, first)).toBe(false)
  })
  it('服务接口拒绝空旋转集合和没有组名的同组限制', () => {
    expect(() => validateRequest({ items: [{ ...cargo('a'), constraints: { horizontalRotations: [] } }] })).toThrow('水平旋转')
    expect(() => validateRequest({ items: [{ ...cargo('a'), constraints: { onlySameMixGroup: true } }] })).toThrow('混装组')
  })
  it('允许按通用货物分类定义贯通框体的空腔内容', () => {
    const frame = { ...cargo('frame'), dimensions: { length: 10, width: 10, height: 2 }, cavity: { dimensions: { length: 8, width: 8, height: 2 }, offset: { x: 1, y: 1, z: 0 }, allowedCategories: ['箱'] } }
    const part = { ...cargo('part'), dimensions: { length: 5, width: 5, height: 2 } }
    const host = { item: frame, position: { x: 0, y: 0, z: 0 }, orientation: 'standing' as const, rotation: 0, actualDimensions: frame.dimensions }
    const child = { item: part, position: { x: 1, y: 1, z: 0 }, orientation: 'standing' as const, rotation: 0, actualDimensions: part.dimensions }
    expect(nestedInside(child, host)).toBe(true)
    expect(nestedInside({ ...child, item: { ...part, category: '玻璃' } }, host)).toBe(false)
    expect(() => validateRequest({ items: [frame] })).not.toThrow()
  })
  it('自定义车厢执行三轴间距，玻璃架不继承伊拉克专项例外', () => {
    const a = { ...cargo('a'), category: '玻璃架' }, b = { ...cargo('b'), category: '玻璃架' }
    const c = createEmptyContainer(0, { ...config, clearanceMm: 2 })
    c.items.push({ item: a, position: { x: 0, y: 0, z: 0 }, orientation: 'standing', rotation: 0, actualDimensions: a.dimensions }); updateContainer(c)
    expect(canPlaceAt(b, { x: 10, y: 0, z: 0 }, 'standing', 0, c)).toBe(false)
    expect(canPlaceAt(b, { x: 12, y: 0, z: 0 }, 'standing', 0, c)).toBe(true)
    const result = optimize([a, b], { ...config, clearanceMm: 2 })
    expect(result.validation?.valid).toBe(true)
    expect(result.unpackedItems).toHaveLength(0)
  })
  it('卷材没有防滚包装确认时不装载，确认后以包装外包建模', () => {
    const coil = { ...cargo('coil'), shape: 'coil' as const }
    const missing = optimize([coil], config)
    expect(missing.unpackedItems[0].constraints?.requiresManualReview).toContain('请确认防滚包装措施')
    expect(missing.unpackedItems[0].constraints?.requiresManualReview).toContain('请确认含包装的外包尺寸')
    const ready = { ...coil, packaging: { antiRoll: true, envelopeConfirmed: true } }
    const result = optimize([ready], config)
    expect(result.unpackedItems).toHaveLength(0)
    expect(result.validation?.valid).toBe(true)
    expect(validateSolution(result, [coil], config).valid).toBe(false)
  })
})
