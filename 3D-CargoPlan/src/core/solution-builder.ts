// #created 11/08/2026
import type { PackingSolution, Container, CargoItem, Dimensions3D } from '../types/packing'
import { updateContainer, volume } from './packing-utils'
import { solidVolume } from './solid-geometry'
import { analyzeUnloading } from './unload-analysis'

/** All aggregates are recomputed from placements; totalItems includes unpacked units. */
export function createPackingSolution(containers: Container[], unpackedItems: CargoItem[], algorithm: string, score: number, computeTime: number, _containerDimensions?: Dimensions3D): PackingSolution {
  const usedContainers = containers.filter(c => c.items.length > 0)
  usedContainers.forEach(updateContainer)
  const placedItems = usedContainers.reduce((sum, c) => sum + c.items.length, 0)
  const avgVolumeUtilization = usedContainers.reduce((sum, c) => sum + c.volumeUtilization, 0) / (usedContainers.length || 1)
  const avgWeightUtilization = usedContainers.reduce((sum, c) => sum + c.weightUtilization, 0) / (usedContainers.length || 1)
  return {
    id: `solution-${algorithm}-${Date.now()}`, containers: usedContainers, totalContainers: usedContainers.length, unloadAnalysis: analyzeUnloading(usedContainers),
    totalItems: placedItems + unpackedItems.length, avgVolumeUtilization, avgWeightUtilization, unpackedItems, score, algorithm, computeTime,
    stats: { totalVolume: usedContainers.reduce((s, c) => s + volume(c.dimensions), 0), usedVolume: usedContainers.reduce((s, c) => s + c.items.reduce((n, p) => n + solidVolume(p.item), 0), 0),
      totalWeight: usedContainers.reduce((s, c) => s + c.totalWeight, 0), containerCount: usedContainers.length, volumeUtilization: avgVolumeUtilization * 100, weightUtilization: avgWeightUtilization * 100, placedItems, executionTime: computeTime }
  }
}
