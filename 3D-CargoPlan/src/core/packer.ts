// #created 11/08/2026
import type { CargoItem, Container, Dimensions3D, Orientation, Position3D } from '../types/packing'
import { calculateActualDimensions, canPlaceAt, findPlacementPoints, tryPlaceItem, updateContainer, volume } from './packing-utils'

/** Compatibility API backed by the same physical checks as every optimizer. */
export function canPlaceItem(item: CargoItem, position: Position3D, container: Container, dimensions: Dimensions3D): boolean { return canPlaceAt(item, position, 'standing', 0, { ...container, dimensions }) }
export function placeItem(item: CargoItem, position: Position3D, container: Container, orientation: Orientation = 'standing') {
  if (!canPlaceAt(item, position, orientation, 0, container)) throw new Error(`不满足装载约束: ${item.id}`)
  const placed = { item, position: { ...position }, orientation, rotation: 0, actualDimensions: calculateActualDimensions(item.dimensions, orientation, 0, item.orientationVerticalAxes) }
  container.items.push(placed); updateContainer(container); return placed
}
export function findBestPosition(item: CargoItem, container: Container, dimensions: Dimensions3D): Position3D | null { const target = { ...container, dimensions }; return findPlacementPoints(target).find(p => canPlaceAt(item, p, 'standing', 0, target)) ?? null }
export function calculateRemainingVolume(container: Container, dimensions: Dimensions3D): number { return volume(dimensions) - container.items.reduce((s, p) => s + volume(p.actualDimensions), 0) }
export function calculateRemainingWeight(container: Container): number { return container.maxWeight - container.items.reduce((s, p) => s + p.item.weight, 0) }
export function createEmptyContainer(id: string, dimensions: Dimensions3D, maxWeight: number): Container { return { id, dimensions: { ...dimensions }, maxWeight, items: [], totalWeight: 0, volumeUtilization: 0, weightUtilization: 0 } }
export function placeItemInContainer(item: CargoItem, container: Container, dimensions: Dimensions3D, position?: Position3D): boolean {
  const target = { ...container, dimensions }, placed = position ? (canPlaceAt(item, position, 'standing', 0, target) ? { item, position, orientation: 'standing' as const, rotation: 0, actualDimensions: calculateActualDimensions(item.dimensions, 'standing', 0, item.orientationVerticalAxes) } : null) : tryPlaceItem(item, target)
  if (!placed) return false
  container.items.push(placed); updateContainer(container); return true
}
