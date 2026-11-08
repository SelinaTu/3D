// #created 11/08/2026
import { describe, expect, it } from 'vitest'
import { colorForGroup, createCargoBatch, groupKey, validateFrame } from './studio-cargo'

describe('工作台手动货物批次', () => {
  const input = { name: '设备箱', category: '箱', dimensions: { length: 600, width: 400, height: 300 }, weight: 12, quantity: 3 }
  it('展开为唯一单件并保留同批次身份', () => {
    const cargo = createCargoBatch(input, 'batch-a', 2)
    expect(cargo).toHaveLength(3)
    expect(new Set(cargo.map(item => item.id)).size).toBe(3)
    expect(new Set(cargo.map(groupKey)).size).toBe(1)
    expect(cargo.every(item => item.quantity === 1 && !item.canStackOnTop)).toBe(true)
    expect(groupKey(createCargoBatch(input, 'batch-b', 2)[0])).not.toBe(groupKey(cargo[0]))
  })
  it('拒绝无名称、无效尺寸或超过总件数限制', () => {
    expect(() => createCargoBatch({ ...input, name: '' }, 'a', 0)).toThrow('名称')
    expect(() => createCargoBatch({ ...input, dimensions: { ...input.dimensions, height: 0 } }, 'a', 0)).toThrow('尺寸')
    expect(() => createCargoBatch(input, 'a', 4998)).toThrow('5000')
  })
  it('为伊拉克样例前 100 个批次提供可稳定复现的不同色值', () => {
    const colors = Array.from({ length: 100 }, (_, i) => colorForGroup(i))
    expect(new Set(colors).size).toBe(100)
    expect(colors.every(color => /^#[0-9a-f]{6}$/.test(color))).toBe(true)
  })
  it('框体外包与空腔同步修改时检查贯穿、越界和框壁', () => {
    const item = { ...createCargoBatch(input, 'a', 0)[0], cavity: { dimensions: { length: 400, width: 200, height: 300 }, offset: { x: 100, y: 100, z: 0 }, allowedCategories: ['箱'] } }
    expect(() => validateFrame(item)).not.toThrow()
    expect(() => validateFrame({ ...item, dimensions: { ...item.dimensions, height: 310 } })).toThrow('贯穿')
    expect(() => validateFrame({ ...item, cavity: { ...item.cavity, offset: { x: 300, y: 100, z: 0 } } })).toThrow('超出')
  })
})
