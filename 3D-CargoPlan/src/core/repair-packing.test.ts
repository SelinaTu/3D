// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import type { CargoItem } from '../types/packing'
import { DEFAULT_CONFIG, optimize } from './optimizer'
import { repairPacking } from './repair-packing'
import { validateSolution } from './validation'

const cargo = (id: string): CargoItem => ({ id, name: id, category: '箱', dimensions: { length: 10, width: 10, height: 10 }, weight: 1, quantity: 1, allowedOrientations: ['standing'], canStackOnTop: false, canOffsetStack: false, hasGlass: false, colorTag: '', rawData: {} })
const config = { ...DEFAULT_CONFIG, algorithm: 'greedy' as const, containerDimensions: { length: 40, width: 10, height: 10 }, containerMaxWeight: 100, timeLimit: 1000 }

describe('旧方案局部修复', () => {
  it('单件改成所有方向均超尺寸时保留其他件，超尺寸件单独待装',()=>{
    const items=['a','b','c'].map(cargo),seed=optimize(items,config)
    const changed=items.map(i=>i.id==='a'?{...i,dimensions:{length:50000,width:50000,height:50000}}:i)
    const result=repairPacking(changed,config,seed)!
    expect(result.validation?.valid).toBe(true);expect(result.unpackedItems.map(i=>i.id)).toEqual(['a'])
    expect(result.containers.flatMap(c=>c.items.map(p=>p.item.id)).sort()).toEqual(['b','c'])
  })
  it('货物尺寸冲突时保留可行位置，重排冲突货物并独立校验', () => {
    const items = ['a','b','c'].map(cargo), seed = optimize(items,config)
    const changed = items.map(item => item.id === 'a' ? { ...item, dimensions: { ...item.dimensions, length: 12 } } : item)
    const result = repairPacking(changed,config,seed)!
    expect(result.totalContainers).toBe(1)
    expect(result.unpackedItems).toHaveLength(0)
    expect(result.validation?.valid).toBe(true)
    expect(result.containers[0].items.find(p => p.item.id === 'a')?.actualDimensions.length).toBe(12)
    expect(result.containers[0].items.find(p => p.item.id === 'c')?.position).toEqual(seed.containers[0].items.find(p => p.item.id === 'c')?.position)
    expect(validateSolution(result,changed,config).valid).toBe(true)
  })
  it('新货物参与装载，原始输入及基线不得被修改', () => {
    const items = [cargo('a'),cargo('b')], seed = optimize(items,config), original = structuredClone(seed)
    const result = repairPacking([...items,cargo('new')],config,seed)!
    expect(result.unpackedItems).toHaveLength(0)
    expect(result.totalItems).toBe(3)
    expect(result.validation?.valid).toBe(true)
    expect(seed).toEqual(original)
  })
  it('缩小或放大货舱后仍可修复有效旧基线，最终按新尺寸校验', () => {
    const items = [cargo('a'),cargo('b')], seed = optimize(items,config)
    const original=structuredClone(seed)
    for(const length of [20,60]) {
      const next={...config,containerDimensions:{...config.containerDimensions,length}}
      const result=repairPacking(items,next,seed)!
      expect(result.totalItems).toBe(2)
      expect(result.totalContainers).toBe(1)
      expect(result.containers[0].dimensions.length).toBe(length)
      expect(validateSolution(result,items,next).valid).toBe(true)
    }
    expect(seed).toEqual(original)
  })
  it('损坏的旧方案仍拒绝作为有效基线',()=>{
    const items = [cargo('a'),cargo('b')], seed = optimize(items,config)
    const damaged = structuredClone(seed); damaged.containers[0].items[1].position.x = 0
    expect(repairPacking(items,config,damaged)).toBeNull()
  })
})
