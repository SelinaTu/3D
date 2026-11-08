// #created 11/08/2026
import { createHash } from 'node:crypto'
import type { CargoItem, OptimizationConfig, PackingSolution, ValidationReport } from '../types/packing'
import { normalizeItems } from './greedy-algorithm'
import { solidVolume } from './solid-geometry'
import { validateSolution } from './validation'

/** Stable provenance serialization, independent of JSON object key insertion order. */
export function canonicalJSON(value: unknown): string {
  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(normalize)
    if (entry !== null && typeof entry === 'object') return Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, normalize(v)]))
    return entry
  }
  return JSON.stringify(normalize(value))
}
export function researchHash(value: unknown): string { return createHash('sha256').update(canonicalJSON(value)).digest('hex') }
export function researchInputHash(items: CargoItem[]): string { return researchHash(normalizeItems(items).sort((a, b) => a.id.localeCompare(b.id))) }
export function allocationHash(containers: string[][]): string { return researchHash(containers.map(ids => [...ids].sort()).sort((a, b) => canonicalJSON(a).localeCompare(canonicalJSON(b)))) }

export interface ResearchContainerMetrics {
  canonicalId: string
  sourceContainerId: string
  sourceIndex: number
  physicalLayoutSha256: string
  placedItems: number
  solidVolumeMm3: number
  solidVolumeM3: number
  solidUtilization: number
  /** Sum of item outer boxes, including double counting of authorized nesting. */
  outerEnvelopeSumMm3: number
  outerEnvelopeSumM3: number
  outerEnvelopeSumRatio: number
  enclosingBox: { length: number; width: number; height: number }
  enclosingBoxVolumeMm3: number
}
export interface ResearchMetrics {
  independentlyValid: boolean
  complete: boolean
  eligible: boolean
  totalContainers: number
  placedItems: number
  unpackedItems: number
  totalSolidVolumeMm3: number
  totalOuterEnvelopeSumMm3: number
  tailSolidVolumeMm3: number
  front10MinimumSolidUtilization: number | null
  physicalLayoutSha256: string
  allocationSha256: string
  containers: ResearchContainerMetrics[]
}
export interface AssessedResearchCandidate { solution: PackingSolution; validation: ValidationReport; metrics: ResearchMetrics }

/** Reordering or renaming containers never changes this fingerprint. */
export function physicalLayoutHash(solution: PackingSolution): string {
  return researchHash(solution.containers.map(container => ({
    dimensions: container.dimensions, maxWeight: container.maxWeight, loadingRules: container.loadingRules,
    items: container.items.map(p => ({ id: p.item.id, position: p.position, orientation: p.orientation, rotation: p.rotation, actualDimensions: p.actualDimensions })).sort((a, b) => a.id.localeCompare(b.id))
  })).sort((a, b) => canonicalJSON(a).localeCompare(canonicalJSON(b))))
}

/** Metrics always use authoritative manifest dimensions and cavities. */
export function assessResearchCandidate(solution: PackingSolution, originals: CargoItem[], config: OptimizationConfig): AssessedResearchCandidate {
  const validation = validateSolution(solution, originals, config)
  const source = new Map(normalizeItems(originals).map(item => [item.id, item]))
  const containers = solution.containers.map((container, sourceIndex) => {
    const orderedItems = [...container.items].sort((a, b) => a.item.id.localeCompare(b.item.id))
    const solidVolumeMm3 = orderedItems.reduce((sum, p) => sum + solidVolume(source.get(p.item.id) ?? p.item), 0)
    const outerEnvelopeSumMm3 = orderedItems.reduce((sum, p) => { const d = (source.get(p.item.id) ?? p.item).dimensions; return sum + d.length * d.width * d.height }, 0)
    const capacity = container.dimensions.length * container.dimensions.width * container.dimensions.height
    const minimum = { x: Infinity, y: Infinity, z: Infinity }, maximum = { x: -Infinity, y: -Infinity, z: -Infinity }
    for (const placed of orderedItems) {
      minimum.x = Math.min(minimum.x, placed.position.x); minimum.y = Math.min(minimum.y, placed.position.y); minimum.z = Math.min(minimum.z, placed.position.z)
      maximum.x = Math.max(maximum.x, placed.position.x + placed.actualDimensions.length); maximum.y = Math.max(maximum.y, placed.position.y + placed.actualDimensions.width); maximum.z = Math.max(maximum.z, placed.position.z + placed.actualDimensions.height)
    }
    const enclosingBox = orderedItems.length ? { length: maximum.x - minimum.x, width: maximum.y - minimum.y, height: maximum.z - minimum.z } : { length: 0, width: 0, height: 0 }
    return { canonicalId: '', sourceContainerId: container.id, sourceIndex, physicalLayoutSha256: physicalLayoutHash({ ...solution, containers: [container] }), placedItems: orderedItems.length, solidVolumeMm3, solidVolumeM3: solidVolumeMm3 / 1e9, solidUtilization: solidVolumeMm3 / capacity, outerEnvelopeSumMm3, outerEnvelopeSumM3: outerEnvelopeSumMm3 / 1e9, outerEnvelopeSumRatio: outerEnvelopeSumMm3 / capacity, enclosingBox, enclosingBoxVolumeMm3: enclosingBox.length * enclosingBox.width * enclosingBox.height }
  }).sort((a, b) => b.solidVolumeMm3 - a.solidVolumeMm3 || a.physicalLayoutSha256.localeCompare(b.physicalLayoutSha256))
  containers.forEach((container, i) => { container.canonicalId = `container-${i + 1}` })
  const placedItems = solution.containers.reduce((sum, container) => sum + container.items.length, 0)
  const complete = solution.unpackedItems.length === 0 && placedItems === source.size
  return { solution, validation, metrics: {
    independentlyValid: validation.valid, complete, eligible: validation.valid && complete, totalContainers: solution.containers.length, placedItems, unpackedItems: solution.unpackedItems.length,
    totalSolidVolumeMm3: containers.reduce((sum, c) => sum + c.solidVolumeMm3, 0), totalOuterEnvelopeSumMm3: containers.reduce((sum, c) => sum + c.outerEnvelopeSumMm3, 0),
    tailSolidVolumeMm3: containers.at(-1)?.solidVolumeMm3 ?? 0, front10MinimumSolidUtilization: containers.length >= 10 ? Math.min(...containers.slice(0, 10).map(c => c.solidUtilization)) : null,
    physicalLayoutSha256: physicalLayoutHash(solution), allocationSha256: allocationHash(solution.containers.map(c => c.items.map(p => p.item.id))), containers
  } }
}

/** <0 means a is better. Failed/partial candidates never outrank a complete valid plan. */
export function compareResearchMetrics(a: ResearchMetrics, b: ResearchMetrics): number {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
  if (!a.eligible) return Number(b.independentlyValid) - Number(a.independentlyValid) || b.placedItems - a.placedItems
  if (a.totalContainers !== b.totalContainers) return a.totalContainers - b.totalContainers
  if (a.totalContainers !== 11) return 0
  const tailDifference = a.tailSolidVolumeMm3 - b.tailSolidVolumeMm3
  if (Math.abs(tailDifference) > Math.max(1, Math.abs(a.tailSolidVolumeMm3) * 1e-12, Math.abs(b.tailSolidVolumeMm3) * 1e-12)) return tailDifference
  const frontDifference = (b.front10MinimumSolidUtilization ?? 0) - (a.front10MinimumSolidUtilization ?? 0)
  return Math.abs(frontDifference) > 1e-12 ? frontDifference : 0
}
export function isResearchImprovement(candidate: ResearchMetrics, incumbent: ResearchMetrics): boolean {
  return candidate.physicalLayoutSha256 !== incumbent.physicalLayoutSha256 && compareResearchMetrics(candidate, incumbent) < 0
}
export function canonicalResearchSolution(assessed: AssessedResearchCandidate): PackingSolution {
  return { ...assessed.solution, containers: assessed.metrics.containers.map(c => ({ ...assessed.solution.containers[c.sourceIndex], id: c.canonicalId })), validation: assessed.validation }
}
