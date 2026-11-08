// #created 11/08/2026
import type { CargoItem, Dimensions3D } from '../types/packing'

export const groupKey = (item: CargoItem) => `${item.rawData._sourceSheet ?? item.category}:${item.rawData._sourceRow ?? item.id}:${item.name}`

export interface NewCargo { name: string; category: string; dimensions: Dimensions3D; weight: number; quantity: number }
export function validateFrame(item: CargoItem): void {
  const c = item.cavity, d = item.dimensions
  if (!c) throw new Error('该货物没有空腔')
  if (![d.length, d.width, d.height, c.dimensions.length, c.dimensions.width, c.dimensions.height].every(n => Number.isFinite(n) && n > 0) || ![c.offset.x,c.offset.y,c.offset.z].every(n => Number.isFinite(n) && n >= 0)) throw new Error('外包和空腔尺寸必须大于 0，偏移不得小于 0')
  const axes = [[d.length,c.dimensions.length,c.offset.x], [d.width,c.dimensions.width,c.offset.y], [d.height,c.dimensions.height,c.offset.z]]
  if (axes.some(([outer, hole, start]) => start + hole > outer)) throw new Error('空腔不能超出货物外包')
  if (!axes.some(([outer, hole, start]) => start === 0 && hole === outer)) throw new Error('至少一个轴需贯穿外包：该轴空腔尺寸等于外包尺寸，偏移为 0')
  if (axes.every(([outer,hole]) => outer === hole)) throw new Error('空腔不能占满整个外包，必须保留框壁')
}
export function createCargoBatch(input: NewCargo, batchId: string, existingCount: number): CargoItem[] {
  const name = input.name.trim(), category = input.category.trim()
  if (!name || !category) throw new Error('请填写货物名称与分类')
  if (!Object.values(input.dimensions).every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(input.weight) || input.weight < 0) throw new Error('尺寸必须大于 0，重量不能为负数')
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || existingCount + input.quantity > 5000) throw new Error('数量必须为正整数，货物总数不能超过 5000 件')
  return Array.from({ length: input.quantity }, (_, i) => ({
    id: `manual-${batchId}-${i + 1}`, name, category, dimensions: { ...input.dimensions }, weight: input.weight, quantity: 1,
    allowedOrientations: ['standing', 'lying', 'flat'], canStackOnTop: false, canOffsetStack: false, hasGlass: false,
    colorTag: '', rawData: { _sourceSheet: '手动添加', _sourceRow: batchId },
  }))
}

/** Golden-angle hue spacing makes adjacent groups visually distinct. */
export function colorForGroup(index: number): string {
  const hue = ((index * 137.508 + 25) % 360) / 60, saturation = 0.55 + Math.floor(index / 360) % 2 * 0.1, light = index % 3 === 0 ? 0.48 : index % 3 === 1 ? 0.58 : 0.65
  const chroma = (1 - Math.abs(2 * light - 1)) * saturation, x = chroma * (1 - Math.abs(hue % 2 - 1)), m = light - chroma / 2
  const rgb = hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x]
  return `#${rgb.map(c => Math.round((c + m) * 255).toString(16).padStart(2, '0')).join('')}`
}
