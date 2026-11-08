// #created 11/08/2026
import type { CargoItem, Container, PlacedItem, Position3D } from '../types/packing'
import { canPlaceAt, findPlacementPoints, maxPlacementHeight, orientationsFor } from './packing-utils'
import { cavityFaceMargins, geometryFor, requiredClearance, supportGap } from './solid-geometry'

/** Variant-specific boundary, centered overhang, real top-face and cavity anchors. */
export function placeResearchItem(item: CargoItem, container: Container, mode: number, deadline: number): PlacedItem | null {
  if (container.totalWeight + item.weight > container.maxWeight) return null
  const variants = orientationsFor(item).sort((a, b) => mode % 3 === 0 ? a.dimensions.length * a.dimensions.width - b.dimensions.length * b.dimensions.width : mode % 3 === 1 ? a.dimensions.height - b.dimensions.height : b.dimensions.height - a.dimensions.height)
  const entries: { position: Position3D; variant: typeof variants[number]; rank: number }[] = []
  for (const variant of variants) {
    const d = variant.dimensions, seen = new Set<string>()
    const add = (x: number, y: number, z: number, same = false) => {
      if (x < -1e-6 || y < -1e-6 || z < -1e-6 || x + d.length > container.dimensions.length + 1e-6 || y + d.width > container.dimensions.width + 1e-6 || z + d.height > maxPlacementHeight(item, container) + 1e-6) return
      const key = `${x}/${y}/${z}`; if (seen.has(key)) return; seen.add(key)
      entries.push({ position: { x: Math.max(0, x), y: Math.max(0, y), z: Math.max(0, z) }, variant, rank: mode >= 3 ? same ? 0 : z > 0 ? 1 : 2 : z === 0 ? 0 : 1 })
    }
    for (const p of findPlacementPoints(container)) add(p.x, p.y, p.z)
    for (const x of [0, container.dimensions.length - d.length]) for (const y of [0, container.dimensions.width - d.width]) add(x, y, 0)
    for (const host of container.items) {
      const p = host.position, q = host.actualDimensions, gap = requiredClearance(item, host.item, container)
      for (const [x, y] of [[p.x + q.length + gap, p.y], [p.x - d.length - gap, p.y], [p.x, p.y + q.width + gap], [p.x, p.y - d.width - gap], [p.x + q.length - d.length, p.y + q.width + gap], [p.x + q.length + gap, p.y + q.width - d.width]]) add(x, y, 0)
      const g = geometryFor(host), support = supportGap(item, host.item, container), same = item.rawData._sourceSheet === host.item.rawData._sourceSheet && item.rawData._sourceRow === host.item.rawData._sourceRow
      if (host.item.canStackOnTop || host.item.cavity) for (const face of g.top) {
        if (!host.item.canStackOnTop && Math.abs(face.z - p.z - q.height) < 1e-6) continue
        for (const x of [face.minX, face.maxX - d.length, (face.minX + face.maxX - d.length) / 2]) for (const y of [face.minY, face.maxY - d.width, (face.minY + face.maxY - d.width) / 2]) add(x, y, face.z + support, same)
      }
      if (g.cavity && host.item.cavity?.allowedSourceSheets?.includes(String(item.rawData._sourceSheet)) && (!host.item.cavity.doorOrientation || item.rawData._sourceSheet !== '门窗' || variant.orientation === host.item.cavity.doorOrientation)) {
        const hole = g.cavity, margin = cavityFaceMargins(host, gap)!
        for (const x of [hole.min.x + margin.min.x, hole.max.x - margin.max.x - d.length]) for (const y of [hole.min.y + margin.min.y, hole.max.y - margin.max.y - d.width]) add(x, y, hole.min.z + margin.min.z)
      }
    }
  }
  entries.sort((a, b) => a.rank - b.rank || a.position.z - b.position.z || (mode % 2 ? a.position.y - b.position.y || a.position.x - b.position.x : a.position.x - b.position.x || a.position.y - b.position.y))
  for (const e of entries) {
    if (Date.now() >= deadline) return null
    if (canPlaceAt(item, e.position, e.variant.orientation, e.variant.rotation, container)) return { item, position: e.position, orientation: e.variant.orientation, rotation: e.variant.rotation, actualDimensions: e.variant.dimensions }
  }
  return null
}
