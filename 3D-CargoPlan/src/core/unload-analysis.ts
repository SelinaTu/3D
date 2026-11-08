// #created 11/08/2026
import type { Container, PlacedItem, UnloadAnalysis } from '../types/packing'
import { contactRectangles, supportGap } from './solid-geometry'

const EPS = 1e-6
const overlaps = (a: number, aSize: number, b: number, bSize: number) => a < b + bSize - EPS && b < a + aSize - EPS

/** Conservative pairwise signals, not a simulation of lifting, doors or rearrangement. */
export function analyzeUnloading(containers: Container[]): UnloadAnalysis | undefined {
  const door = containers.find(c => c.unloadingDoor)?.unloadingDoor
  if (!door) return undefined
  const blockers: UnloadAnalysis['blockers'] = []
  for (const container of containers) {
    for (const target of container.items) for (const obstacle of container.items) {
      const stop = target.item.unloadStop, obstacleStop = obstacle.item.unloadStop
      if (target === obstacle || stop === undefined || obstacleStop === undefined || obstacleStop <= stop) continue
      const reasons: Array<'door-projection' | 'supports-blocker'> = []
      if (blocksDoor(target, obstacle, door)) reasons.push('door-projection')
      if (contactRectangles(obstacle, target, supportGap(obstacle.item, target.item, container)).length) reasons.push('supports-blocker')
      if (reasons.length) blockers.push({ containerId: container.id, itemId: target.item.id, blockedById: obstacle.item.id, stop, blockerStop: obstacleStop, reasons })
    }
  }
  return { model: 'straight-door-projection', door, blockerPairCount: blockers.length, blockers }
}
function blocksDoor(target: PlacedItem, obstacle: PlacedItem, door: 'x-min' | 'x-max'): boolean {
  const t = target.position, o = obstacle.position, td = target.actualDimensions, od = obstacle.actualDimensions
  const overlapsProjection = overlaps(t.y, td.width, o.y, od.width) && overlaps(t.z, td.height, o.z, od.height)
  // Equal leading edges can occur for nested hollow frames; flag conservatively.
  const inFront = door === 'x-min' ? o.x <= t.x + EPS : o.x + od.length >= t.x + td.length - EPS
  return overlapsProjection && inFront
}
