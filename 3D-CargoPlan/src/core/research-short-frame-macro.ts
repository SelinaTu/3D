// #created 11/08/2026
import type { CargoItem, Container, PlacedItem, Position3D } from '../types/packing'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, updateContainer } from './packing-utils'

/** Eight short frames use one 110 mm wide lying base; upper plates clear 1584.5 mm doors. */
export function placeShortFrameCanopyMacro(container: Container, shortItems: CargoItem[], origin: Position3D = { x: 0, y: 0, z: 0 }, rotation: 0 | 90 = 0): { accepted: boolean; placements: PlacedItem[]; attempts: unknown[]; rejection?: string; baseLoadKg?: number } {
  const attempts: unknown[] = [], placements: PlacedItem[] = []
  if (!shortItems.length || shortItems.length > 8 || shortItems.some(i => i.rawData._sourceSheet !== '门窗' || i.rawData._sourceRow !== 21)) return { accepted: false, placements, attempts, rejection: 'Expected 1–8 source W01 short frames from row 21' }
  const staged: Container = { ...container, items: [...container.items] }, ids = new Set(container.items.map(p => p.item.id))
  try {
    for (let i = 0; i < shortItems.length; i++) {
      const item = shortItems[i], orientation = i ? 'flat' as const : 'lying' as const
      const local = i ? { x: 0, y: 0, z: 1679 + (i - 1) * 115 } : { x: 0, y: 782, z: 0 }
      const position = { x: origin.x + (rotation ? local.y : local.x), y: origin.y + (rotation ? local.x : local.y), z: origin.z + local.z }
      const accepted = !ids.has(item.id) && canPlaceAt(item, position, orientation, rotation, staged)
      attempts.push({ id: item.id, position, orientation, rotation, accepted })
      if (!accepted) throw new Error(`Real geometry/load engine rejected ${item.id}`)
      const placed = { item, position, orientation, rotation, actualDimensions: calculateActualDimensions(item.dimensions, orientation, rotation, item.orientationVerticalAxes) }
      staged.items.push(placed); placements.push(placed); ids.add(item.id); updateContainer(staged)
    }
  } catch (error) { return { accepted: false, placements: [], attempts, rejection: error instanceof Error ? error.message : String(error) } }
  const stack = analyzeStacking(staged.items, staged.loadingRules)
  if (stack.errors.length) return { accepted: false, placements: [], attempts, rejection: stack.errors.join('; ') }
  const baseLoadKg = stack.topLoads[container.items.length]
  container.items = staged.items; updateContainer(container)
  return { accepted: true, placements, attempts, baseLoadKg }
}
