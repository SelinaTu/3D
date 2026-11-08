// #created 11/08/2026
import type { CargoItem, Container, Orientation, PlacedItem, Position3D } from '../types/packing'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, updateContainer } from './packing-utils'

/** A verified bounded construction; it commits only after every piece passes the real engine. */
export function placeTallLongFrameMacro(container: Container, longItems: CargoItem[], thinItems: CargoItem[] = [], origin: Position3D = { x: 0, y: 0, z: 0 }): { accepted: boolean; placements: PlacedItem[]; attempts: unknown[]; rejection?: string; baseLoadsKg?: number[] } {
  const attempts: unknown[] = [], placements: PlacedItem[] = []
  if (longItems.length < 8 || longItems.length > 22 || thinItems.length > 20 || longItems.some(i => i.rawData._sourceSheet !== '门窗' || i.rawData._sourceRow !== 23) || thinItems.some(i => i.rawData._sourceSheet !== '门窗' || i.rawData._sourceRow !== 25)) return { accepted: false, placements, attempts, rejection: 'Expected 8–22 source long frames and at most 20 source long thin profiles' }
  const staged: Container = { ...container, items: [...container.items] }, existing = new Set(container.items.map(p => p.item.id))
  const put = (item: CargoItem, y: number, z: number, orientation: Orientation) => {
    const position = { x: origin.x, y: origin.y + y, z: origin.z + z }, accepted = !existing.has(item.id) && canPlaceAt(item, position, orientation, 0, staged)
    attempts.push({ id: item.id, position, orientation, rotation: 0, accepted })
    if (!accepted) throw new Error(`Real geometry/load engine rejected ${item.id}`)
    const placed: PlacedItem = { item, position, orientation, rotation: 0, actualDimensions: calculateActualDimensions(item.dimensions, orientation, 0, item.orientationVerticalAxes) }
    staged.items.push(placed); placements.push(placed); existing.add(item.id); updateContainer(staged)
  }
  try {
    const supports = [0, 215, 430, 645, 1205, 1420, 1635, 1965]
    supports.forEach((y, i) => put(longItems[i], y, 0, 'lying'))
    // These offsets equalize actual frame-rail contact, not bounding-box contact.
    // With 7 flat frames per pile, each of the six largest base loads is 119.952 kg.
    for (let j = 8; j < longItems.length; j++) { const k = j - 8; put(longItems[j], k % 2 ? 1095 : 90, 995 + Math.floor(k / 2) * 215, 'flat') }
    for (let j = 0; j < thinItems.length; j++) put(thinItems[j], [860, 975, 1090, 1850][Math.floor(j / 5)], (j % 5) * 185, 'lying')
  } catch (error) { return { accepted: false, placements: [], attempts, rejection: error instanceof Error ? error.message : String(error) } }
  const stacking = analyzeStacking(staged.items, staged.loadingRules)
  if (stacking.errors.length) return { accepted: false, placements: [], attempts, rejection: stacking.errors.join('; ') }
  const baseLoadsKg = stacking.topLoads.slice(container.items.length, container.items.length + 8)
  container.items = staged.items; updateContainer(container)
  return { accepted: true, placements, attempts, baseLoadsKg }
}
