// #created 11/08/2026
import type { CargoItem } from '../types/packing'
import type { DemoPiece, DemoStop } from './priority-pack'

const SHEET_PRIORITY: Record<string, number> = { 辅材: 1, 门窗: 2, 玻璃架: 3 }
const COLORS = ['#156a66', '#dca54e', '#8c87ac', '#398d9e', '#b38d70', '#6ca8b2']
const GROUP_HEADERS = new Set(['站点', '目的地', '优先组', '卸货组'])

export interface ExcelShipment {
  name: string
  count: number
  pieces: DemoPiece[]
  stops: DemoStop[]
}

function explicitGroup(item: CargoItem): string | null {
  for (const [key, value] of Object.entries(item.rawData)) {
    if (!GROUP_HEADERS.has(key.replace(/\s/g, ''))) continue
    const text = String(value ?? '').trim()
    if (text && text !== 'null') return text
  }
  return null
}

function priorityFor(name: string, index: number): number {
  const numeric = Number(name)
  if (Number.isInteger(numeric) && numeric > 0) return numeric
  return SHEET_PRIORITY[name] ?? index + 1
}

/** Turn imported units into unload groups. A 站点/优先组 column wins; otherwise each worksheet is a group. */
export function shipmentFromItems(items: CargoItem[], name: string): ExcelShipment {
  const explicit = items.some((item) => explicitGroup(item))
  const grouped = new Map<string, CargoItem[]>()
  for (const item of items) {
    const key = (explicit ? explicitGroup(item) : null) || String(item.rawData._sourceSheet || '未分组')
    const list = grouped.get(key) || []
    list.push(item)
    grouped.set(key, list)
  }
  const names = [...grouped.keys()]
  const stops = names.map((groupName, index) => ({
    id: groupName,
    name: groupName,
    priority: priorityFor(groupName, index),
    color: COLORS[index % COLORS.length],
  }))
  const pieces = names.flatMap((groupName) => (grouped.get(groupName) || []).map((item) => ({ item, stopId: groupName })))
  return { name, count: items.length, pieces, stops }
}
