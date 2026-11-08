// #created 11/08/2026
import type { CargoItem, OptimizationConfig, PackingSolution } from '../types/packing'
import { createEmptyContainer, normalizeItems } from './greedy-algorithm'
import { calculateActualDimensions, canPlaceAt, updateContainer } from './packing-utils'
import { createPackingSolution } from './solution-builder'
import { validateSolution } from './validation'
import { pairGeometryErrors } from './solid-geometry'

/** Keep original positions only where they still pass the new constraints; never repack here. */
export function previewPacking(items: CargoItem[], config: OptimizationConfig, seed: PackingSolution): PackingSolution {
  const units = normalizeItems(items), byId = new Map(units.map(i => [i.id,i])), retained = new Set<string>()
  const containers = seed.containers.map((old, index) => {
    const next = createEmptyContainer(index,config,units); next.id = old.id
    const proposed = old.items.flatMap(p => {
      const item = byId.get(p.item.id)
      return item ? [{ ...p, item, position: { ...p.position }, actualDimensions: calculateActualDimensions(item.dimensions,p.orientation,p.rotation,item.orientationVerticalAxes) }] : []
    })
    next.items = proposed; updateContainer(next)
    const present = new Set(proposed.map(p => p.item.id)), rest = units.filter(i => !present.has(i.id))
    const check = createPackingSolution([next],rest,'PREVIEW-CHECK',0,0)
    if (proposed.length && validateSolution(check,units,config).valid) { proposed.forEach(p => retained.add(p.item.id)); return next }
    next.items = []; updateContainer(next)
    const oldById = new Map(old.items.map(p=>[p.item.id,p]))
    const isChanged = (p: typeof proposed[number]) => JSON.stringify(p.item) !== JSON.stringify(oldById.get(p.item.id)?.item)
    const unchanged = proposed.filter(p=>!isChanged(p))
    for (const placed of [...proposed].sort((a,b) => a.position.z - b.position.z || Number(!a.item.cavity) - Number(!b.item.cavity) || a.item.id.localeCompare(b.item.id))) {
      // Prefer an unchanged occupant over an enlarged/otherwise edited item when their old positions conflict.
      if (isChanged(placed) && unchanged.some(other=>pairGeometryErrors(placed,other,next).length > 0)) continue
      if (canPlaceAt(placed.item,placed.position,placed.orientation,placed.rotation,next)) { next.items.push(placed); updateContainer(next); retained.add(placed.item.id) }
    }
    return next
  })
  const result = createPackingSolution(containers,units.filter(i => !retained.has(i.id)),'PREVIEW-UNCHANGED-POSITIONS',0,0)
  result.validation = validateSolution(result,units,config)
  if (!result.validation.valid) throw new Error(`原位置预检查未通过：${result.validation.errors.slice(0,2).join('；')}`)
  return result
}
