// #created 11/08/2026
import type { CargoItem, Container, Orientation, PlacedItem, Position3D } from '../types/packing'
import { analyzeStacking, calculateActualDimensions, canPlaceAt, updateContainer } from './packing-utils'

/** Ten floor bases distribute the fourteen upper frames below each strict 120 kg limit. */
export function placeTwentyFourLongFrameMacro(container: Container, longUnits: CargoItem[], origin: Position3D = { x: 0, y: 0, z: 0 }): { accepted: boolean; placements: PlacedItem[]; rejection?: string; baseLoadsKg?: number[] } {
  if (longUnits.length !== 24 || longUnits.some(i => i.rawData._sourceSheet !== '门窗' || i.rawData._sourceRow !== 23)) return { accepted: false, placements: [], rejection: 'Exactly 24 original source long frames are required' }
  const staged: Container = { ...container, items: [...container.items] }, placements: PlacedItem[] = [], ids = new Set(container.items.map(p => p.item.id))
  const put = (item: CargoItem, y: number, z: number, orientation: Orientation) => {
    const position = { x: origin.x, y: origin.y + y, z: origin.z + z }
    if (ids.has(item.id) || !canPlaceAt(item, position, orientation, 0, staged)) throw Error(`Geometry/load rejection for ${item.id}`)
    const placed = { item, position, orientation, rotation: 0, actualDimensions: calculateActualDimensions(item.dimensions, orientation, 0, item.orientationVerticalAxes) }
    staged.items.push(placed); placements.push(placed); ids.add(item.id); updateContainer(staged)
  }
  try {
    for (let k = 0; k < 10; k++) put(longUnits[k], 20 + 215 * k, 0, 'lying')
    for (let k = 0; k < 14; k++) put(longUnits[10 + k], k % 2 ? 1045 : 0, 995 + Math.floor(k / 2) * 215, 'flat')
  } catch (error) { return { accepted: false, placements: [], rejection: error instanceof Error ? error.message : String(error) } }
  const analysis = analyzeStacking(staged.items, staged.loadingRules)
  if (analysis.errors.length) return { accepted: false, placements: [], rejection: analysis.errors.join('; ') }
  const baseLoadsKg = analysis.topLoads.slice(container.items.length, container.items.length + 10)
  container.items = staged.items; updateContainer(container)
  return { accepted: true, placements, baseLoadsKg }
}
