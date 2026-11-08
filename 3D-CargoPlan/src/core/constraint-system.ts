// #created 11/08/2026
import type { CargoItem, Container, Position3D, OptimizationConfig } from '../types/packing'
import { analyzeStacking, calculateActualDimensions, calculateBounds, checkOverlap, canPlaceAt } from './packing-utils'

export interface Constraint {
  name: string
  priority: number
  check: (item: CargoItem, position: Position3D, container: Container, config: OptimizationConfig) => boolean
  penalty?: (item: CargoItem, position: Position3D, container: Container, config: OptimizationConfig) => number
}
const candidate = (item: CargoItem, position: Position3D) => ({ item, position, orientation: 'standing' as const, rotation: 0, actualDimensions: calculateActualDimensions(item.dimensions, 'standing', 0, item.orientationVerticalAxes) })
export const BoundaryConstraint: Constraint = { name: 'BOUNDARY', priority: 1, check: (item, p, _c, config) => { const d = candidate(item, p).actualDimensions; return p.x >= 0 && p.y >= 0 && p.z >= 0 && p.x + d.length <= config.containerDimensions.length && p.y + d.width <= config.containerDimensions.width && p.z + d.height <= config.containerDimensions.height } }
export const NotOverlappingConstraint: Constraint = { name: 'NOT_OVERLAPPING', priority: 1, check: (item, p, c) => !c.items.some(other => checkOverlap(calculateBounds(candidate(item, p)), calculateBounds(other))) }
export const WeightConstraint: Constraint = { name: 'WEIGHT_LIMIT', priority: 1, check: (item, _p, c, config) => c.items.reduce((s, p) => s + p.item.weight, 0) + item.weight <= config.containerMaxWeight }
export const SupportConstraint: Constraint = { name: 'SUPPORT_AND_STACKING', priority: 1, check: (item, p, c) => analyzeStacking([...c.items, candidate(item, p)]).errors.length === 0 }
export const FragileConstraint: Constraint = { ...SupportConstraint, name: 'STACK_PERMISSION' }
export const MaxStackWeightConstraint: Constraint = { ...SupportConstraint, name: 'CASCADING_STACK_LOAD' }
export function checkAllConstraints(item: CargoItem, p: Position3D, c: Container, config: OptimizationConfig, constraints: Constraint[] = [BoundaryConstraint, NotOverlappingConstraint, WeightConstraint, SupportConstraint]) {
  let penalty = 0
  for (const rule of constraints) if (!rule.check(item, p, c, config)) { if (rule.priority >= 1) return { valid: false, penalty: Infinity }; penalty += rule.penalty?.(item, p, c, config) ?? 0 }
  return { valid: true, penalty }
}
export function checkHardConstraints(item: CargoItem, p: Position3D, c: Container, config: OptimizationConfig): boolean { return canPlaceAt(item, p, 'standing', 0, { ...c, dimensions: config.containerDimensions, maxWeight: config.containerMaxWeight }) }
