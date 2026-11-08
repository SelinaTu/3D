// #created 11/08/2026
import type { PackingSolution, Container, Dimensions3D, CargoItem, OptimizationConfig } from '../types/packing'
import { updateContainer } from './packing-utils'

export function evaluateContainer(container: Container, containerDimensions: Dimensions3D) {
  updateContainer(container)
  const centerOfGravity = container.centerOfGravity!
  const offset = Math.abs(centerOfGravity.x - containerDimensions.length / 2) / containerDimensions.length + Math.abs(centerOfGravity.y - containerDimensions.width / 2) / containerDimensions.width
  const stabilityScore = Math.max(0, 1 - (offset + centerOfGravity.z / containerDimensions.height) / 2)
  return { volumeUtilization: container.volumeUtilization, weightUtilization: container.weightUtilization, stabilityScore, centerOfGravity }
}
export function calculateSolutionScore(containers: Container[], unpackedItems: CargoItem[], containerDimensions: Dimensions3D, weights: OptimizationConfig['weights'] = { containerCount: 1000, volumeUtilization: 500, weightBalance: 200, stabilityPenalty: 300 }): number {
  const used = containers.filter(c => c.items.length)
  const reward = used.reduce((s, c) => {
    const e = evaluateContainer(c, containerDimensions), cg = e.centerOfGravity
    const balance = 1 - (Math.abs(cg.x - containerDimensions.length / 2) / containerDimensions.length + Math.abs(cg.y - containerDimensions.width / 2) / containerDimensions.width)
    const lowGravity = 1 - cg.z / containerDimensions.height
    return s + e.volumeUtilization * weights.volumeUtilization + balance * weights.weightBalance + lowGravity * weights.stabilityPenalty
  }, 0) / (used.length || 1)
  return -unpackedItems.length * 1e9 - used.length * weights.containerCount + reward
}
export function evaluateSolution(solution: PackingSolution, containerDimensions: Dimensions3D): number {
  return calculateSolutionScore(solution.containers, solution.unpackedItems, containerDimensions)
}
/** Lexicographic feasibility and completeness always dominate aesthetic scores. */
export function compareSolutions(a: PackingSolution, b: PackingSolution): number {
  return a.unpackedItems.length - b.unpackedItems.length || a.totalContainers - b.totalContainers || (a.unloadAnalysis && b.unloadAnalysis ? a.unloadAnalysis.blockerPairCount - b.unloadAnalysis.blockerPairCount : 0) || b.score - a.score
}
export function calculateStats(solution: PackingSolution, _containerDimensions: Dimensions3D) {
  return { containerCount: solution.totalContainers, placedItems: solution.containers.reduce((s, c) => s + c.items.length, 0), unpackedItems: solution.unpackedItems.length, volumeUtilization: solution.avgVolumeUtilization * 100, weightUtilization: solution.avgWeightUtilization * 100, executionTime: solution.computeTime }
}
