// #created 11/08/2026
import type { CargoItem, Container, Orientation, PlacedItem, Position3D } from '../types/packing'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, updateContainer } from './packing-utils'

/** 9 lying bases + 14 flat upper frames; two legal floor gaps hold 10 long thin profiles. */
export function placeTwentyThreeLongFrameMacro(container: Container, longUnits: CargoItem[], thinUnits: CargoItem[] = [], origin: Position3D = { x: 0, y: 0, z: 0 }): { accepted: boolean; placements: PlacedItem[]; attempts: unknown[]; rejection?: string; baseLoadsKg?: number[] } {
  const placements: PlacedItem[] = [], attempts: unknown[] = []
  if (longUnits.length !== 23 || thinUnits.length > 10 || longUnits.some(i => i.rawData._sourceSheet !== '门窗' || i.rawData._sourceRow !== 23) || thinUnits.some(i => i.rawData._sourceSheet !== '门窗' || i.rawData._sourceRow !== 25)) return { accepted: false, placements, attempts, rejection: 'Requires exactly 23 source long frames and at most 10 matching source thin profiles' }
  const staged: Container = { ...container, items: [...container.items] }, ids = new Set(container.items.map(p => p.item.id))
  const put = (item: CargoItem, y: number, z: number, orientation: Orientation) => {
    const position = { x: origin.x, y: origin.y + y, z: origin.z + z }, accepted = !ids.has(item.id) && canPlaceAt(item, position, orientation, 0, staged)
    attempts.push({ id: item.id, position, orientation, rotation: 0, accepted })
    if (!accepted) throw Error(`Real geometry/load engine rejected ${item.id}`)
    const p = { item, position, orientation, rotation: 0, actualDimensions: calculateActualDimensions(item.dimensions, orientation, 0, item.orientationVerticalAxes) }
    staged.items.push(p); placements.push(p); ids.add(item.id); updateContainer(staged)
  }
  try {
    const bases = [0, 215, 430, 645, 860, 1205, 1420, 1635, 1965]
    bases.forEach((y, i) => put(longUnits[i], y, 0, 'lying'))
    // Y100 keeps the additional fifth support below its strict 120 kg limit.
    for (let k = 0; k < 14; k++) put(longUnits[9 + k], k % 2 ? 1095 : 100, 995 + Math.floor(k / 2) * 215, 'flat')
    for (let k = 0; k < thinUnits.length; k++) put(thinUnits[k], k < 5 ? 1075 : 1850, (k % 5) * 185, 'lying')
  } catch (error) { return { accepted: false, placements: [], attempts, rejection: error instanceof Error ? error.message : String(error) } }
  const stack = analyzeStacking(staged.items, staged.loadingRules)
  if (stack.errors.length) return { accepted: false, placements: [], attempts, rejection: stack.errors.join('; ') }
  const baseLoadsKg = stack.topLoads.slice(container.items.length, container.items.length + 9)
  container.items = staged.items; updateContainer(container)
  return { accepted: true, placements, attempts, baseLoadsKg }
}
