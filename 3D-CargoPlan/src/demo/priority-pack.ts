// #created 11/08/2026
import type { CargoItem, Container, Dimensions3D, Orientation, PlacedItem, Position3D } from '../types/packing'
import { orientationsFor, volume } from '../core/packing-utils'

const EPS = 0.5

export interface DemoStop {
  id: string
  name: string
  /** 1 unloads first and is packed last, beside the door. */
  priority: number
  color: string
}

export interface DemoPiece {
  item: CargoItem
  stopId: string
}

export interface DemoVehicle {
  id: string
  name: string
  dimensions: Dimensions3D
  maxWeightKg: number
  doorLabel: string
}

export interface PlacedPiece {
  item: CargoItem
  stopId: string
  position: Position3D
  orientation: Orientation
  rotation: number
  actualDimensions: Dimensions3D
}

export interface BlockedPiece {
  itemId: string
  stopId: string
  blockedBy: string[]
}

export interface PackPlan {
  vehicle: DemoVehicle
  stops: DemoStop[]
  mode: 'priority' | 'bulk'
  placed: PlacedPiece[]
  unpacked: { item: CargoItem; stopId: string; reason: string }[]
  loadOrder: PlacedPiece[]
  blocking: BlockedPiece[]
  crossStopBlocks: number
  totalWeightKg: number
  volumeUtilization: number
  centerOfGravity: Position3D | null
  thirdsKg: [number, number, number]
  heavyOnLight: { upperId: string; lowerId: string }[]
}

function sameSku(a: CargoItem, b: CargoItem): boolean {
  return a.name === b.name && a.rawData._sourceSheet === b.rawData._sourceSheet && a.rawData._sourceRow === b.rawData._sourceRow
}

function canStack(lower: CargoItem, upper: CargoItem, nextLoad: number, stackCount: number): boolean {
  if (!lower.canStackOnTop || !sameSku(lower, upper)) return false
  if (!(lower.stackableWith ?? []).includes('@self')) return false
  if (lower.maxStackCount !== undefined && stackCount >= lower.maxStackCount) return false
  if (lower.maxStackWeight !== undefined && nextLoad > lower.maxStackWeight + EPS) return false
  return true
}

function poseAt(item: CargoItem, vehicle: DemoVehicle, x: number, y: number, z: number) {
  let best: { orientation: Orientation; rotation: number; dimensions: Dimensions3D } | null = null
  for (const pose of orientationsFor(item)) {
    const d = pose.dimensions
    if (x + d.length > vehicle.dimensions.length + EPS) continue
    if (y + d.width > vehicle.dimensions.width + EPS) continue
    if (z + d.height > vehicle.dimensions.height + EPS) continue
    if (!best || d.length < best.dimensions.length - EPS || (Math.abs(d.length - best.dimensions.length) <= EPS && d.width < best.dimensions.width)) best = pose
  }
  return best
}

function place(piece: DemoPiece, x: number, y: number, z: number, pose: NonNullable<ReturnType<typeof poseAt>>): PlacedPiece {
  return { item: piece.item, stopId: piece.stopId, position: { x, y, z }, orientation: pose.orientation, rotation: pose.rotation, actualDimensions: pose.dimensions }
}

function minDepth(item: CargoItem, vehicle: DemoVehicle): number {
  return poseAt(item, vehicle, 0, 0, 0)?.dimensions.length ?? Number.POSITIVE_INFINITY
}

function packBand(pieces: DemoPiece[], vehicle: DemoVehicle, x0: number, weightBudget: number | null): { placed: PlacedPiece[]; unpacked: PackPlan['unpacked']; cursor: number; usedWeight: number } {
  const pending = [...pieces].sort((a, b) => minDepth(b.item, vehicle) - minDepth(a.item, vehicle) || b.item.weight - a.item.weight || a.item.id.localeCompare(b.item.id))
  const placed: PlacedPiece[] = []
  let x = x0
  let usedWeight = 0
  const fitsWeight = (weight: number) => weightBudget === null || usedWeight + weight <= weightBudget + EPS
  while (pending.length) {
    const rowStart = placed.length
    let y = 0
    let rowDepth = 0
    let moved = true
    while (moved) {
      moved = false
      for (let i = 0; i < pending.length; i += 1) {
        const pose = poseAt(pending[i].item, vehicle, x, y, 0)
        if (!pose || !fitsWeight(pending[i].item.weight)) continue
        if (rowDepth > EPS && pose.dimensions.length > rowDepth + EPS) continue
        const base = pending.splice(i, 1)[0]
        placed.push(place(base, x, y, 0, pose))
        usedWeight += base.item.weight
        y += pose.dimensions.width
        rowDepth = Math.max(rowDepth, pose.dimensions.length)
        let z = pose.dimensions.height
        let stackWeight = 0
        let stackCount = 1
        let stacked = true
        while (stacked) {
          stacked = false
          const idx = pending.findIndex((piece) => fitsWeight(piece.item.weight) && canStack(base.item, piece.item, stackWeight + piece.item.weight, stackCount))
          if (idx < 0) break
          const upperPose = poseAt(pending[idx].item, vehicle, x, y - pose.dimensions.width, z)
          if (!upperPose) break
          if (Math.abs(upperPose.dimensions.length - pose.dimensions.length) > EPS || Math.abs(upperPose.dimensions.width - pose.dimensions.width) > EPS) break
          const upper = pending.splice(idx, 1)[0]
          placed.push(place(upper, x, y - pose.dimensions.width, z, upperPose))
          usedWeight += upper.item.weight
          z += upperPose.dimensions.height
          stackWeight += upper.item.weight
          stackCount += 1
          stacked = true
        }
        moved = true
        break
      }
    }
    if (placed.length === rowStart) {
      return {
        placed,
        unpacked: pending.map((piece) => ({
          item: piece.item,
          stopId: piece.stopId,
          reason: weightBudget !== null && !fitsWeight(piece.item.weight) ? '超过当前载重' : '剩余长度、宽度或高度放不下允许的摆放',
        })),
        cursor: x,
        usedWeight,
      }
    }
    x += rowDepth
  }
  return { placed, unpacked: [], cursor: x, usedWeight }
}

function overlaps(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 - EPS && b0 < a1 - EPS
}

function blocksDoor(blocker: PlacedPiece, item: PlacedPiece): boolean {
  const doorSide = blocker.position.x >= item.position.x + item.actualDimensions.length - EPS
  return doorSide
    && overlaps(blocker.position.y, blocker.position.y + blocker.actualDimensions.width, item.position.y, item.position.y + item.actualDimensions.width)
    && overlaps(blocker.position.z, blocker.position.z + blocker.actualDimensions.height, item.position.z, item.position.z + item.actualDimensions.height)
}

function restsOn(upper: PlacedPiece, lower: PlacedPiece): boolean {
  const touching = Math.abs(upper.position.z - (lower.position.z + lower.actualDimensions.height)) <= EPS
  return touching && overlaps(upper.position.x, upper.position.x + upper.actualDimensions.length, lower.position.x, lower.position.x + lower.actualDimensions.length)
    && overlaps(upper.position.y, upper.position.y + upper.actualDimensions.width, lower.position.y, lower.position.y + lower.actualDimensions.width)
}

export interface PackOptions {
  respectWeight?: boolean
  groupGapMm?: number
}

export function packPlan(vehicle: DemoVehicle, pieces: DemoPiece[], stops: DemoStop[], mode: 'priority' | 'bulk', options: PackOptions = {}): PackPlan {
  const byStop = new Map(stops.map((stop) => [stop.id, stop]))
  for (const piece of pieces) {
    if (!byStop.has(piece.stopId)) throw new Error(`货物 ${piece.item.id} 的站点 ${piece.stopId} 没有定义`)
  }
  const placed: PlacedPiece[] = []
  const unpacked: PackPlan['unpacked'] = []
  let cursor = 0
  let weightLeft = options.respectWeight ? vehicle.maxWeightKg : null
  const bands = mode === 'priority'
    ? [...stops].sort((a, b) => b.priority - a.priority).map((stop) => pieces.filter((piece) => piece.stopId === stop.id))
    : [pieces]
  bands.forEach((band, index) => {
    const result = packBand(band, vehicle, cursor, weightLeft)
    placed.push(...result.placed)
    unpacked.push(...result.unpacked)
    cursor = result.cursor
    if (weightLeft !== null) weightLeft -= result.usedWeight
    const gap = options.groupGapMm || 0
    if (mode === 'priority' && gap > 0 && result.placed.length && index < bands.length - 1) cursor += gap
  })
  const priorityOf = (stopId: string) => byStop.get(stopId)?.priority ?? 0
  const blocking = placed.map((item) => {
    const blockedBy = placed.filter((other) => other.item.id !== item.item.id && priorityOf(other.stopId) > priorityOf(item.stopId) && blocksDoor(other, item)).map((other) => other.item.id)
    return { itemId: item.item.id, stopId: item.stopId, blockedBy }
  }).filter((row) => row.blockedBy.length > 0)
  const totalWeightKg = placed.reduce((sum, piece) => sum + piece.item.weight, 0)
  const used = placed.reduce((sum, piece) => sum + volume(piece.actualDimensions), 0)
  const capacity = volume(vehicle.dimensions)
  let centerOfGravity: Position3D | null = null
  const thirdsKg: [number, number, number] = [0, 0, 0]
  if (totalWeightKg > EPS) {
    const acc = placed.reduce((sum, piece) => {
      const center = { x: piece.position.x + piece.actualDimensions.length / 2, y: piece.position.y + piece.actualDimensions.width / 2, z: piece.position.z + piece.actualDimensions.height / 2 }
      return { x: sum.x + piece.item.weight * center.x, y: sum.y + piece.item.weight * center.y, z: sum.z + piece.item.weight * center.z }
    }, { x: 0, y: 0, z: 0 })
    centerOfGravity = { x: acc.x / totalWeightKg, y: acc.y / totalWeightKg, z: acc.z / totalWeightKg }
    const span = vehicle.dimensions.length / 3
    for (const piece of placed) {
      const centerX = piece.position.x + piece.actualDimensions.length / 2
      const index = Math.min(2, Math.floor(centerX / span)) as 0 | 1 | 2
      thirdsKg[index] += piece.item.weight
    }
  }
  const heavyOnLight: PackPlan['heavyOnLight'] = []
  for (const upper of placed) {
    for (const lower of placed) {
      if (upper.item.id !== lower.item.id && restsOn(upper, lower) && upper.item.weight > lower.item.weight + EPS) heavyOnLight.push({ upperId: upper.item.id, lowerId: lower.item.id })
    }
  }
  const loadOrder = [...placed].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y || a.position.z - b.position.z || a.item.id.localeCompare(b.item.id))
  return {
    vehicle, stops, mode, placed, unpacked, loadOrder, blocking, crossStopBlocks: blocking.length, totalWeightKg,
    volumeUtilization: capacity > 0 ? used / capacity : 0, centerOfGravity, thirdsKg, heavyOnLight,
  }
}

export function unloadOrder(plan: PackPlan, stopId: string): PlacedPiece[] {
  return plan.placed.filter((piece) => piece.stopId === stopId).sort((a, b) => b.position.x - a.position.x || a.position.y - b.position.y || b.position.z - a.position.z)
}

export function toContainer(plan: PackPlan, visibleIds: Set<string> | null): Container {
  const colors = new Map(plan.stops.map((stop) => [stop.id, stop.color]))
  const items: PlacedItem[] = plan.placed.filter((piece) => visibleIds === null || visibleIds.has(piece.item.id)).map((piece) => ({
    item: { ...piece.item, colorTag: colors.get(piece.stopId) || piece.item.colorTag },
    position: piece.position,
    orientation: piece.orientation,
    rotation: piece.rotation,
    actualDimensions: piece.actualDimensions,
  }))
  const totalWeight = items.reduce((sum, piece) => sum + piece.item.weight, 0)
  const center = { x: 0, y: 0, z: 0 }
  for (const p of items) {
    center.x += (p.position.x + p.actualDimensions.length / 2) * p.item.weight
    center.y += (p.position.y + p.actualDimensions.width / 2) * p.item.weight
    center.z += (p.position.z + p.actualDimensions.height / 2) * p.item.weight
  }
  return {
    id: plan.vehicle.id,
    unloadingDoor: 'x-max',
    dimensions: plan.vehicle.dimensions,
    maxWeight: plan.vehicle.maxWeightKg,
    items,
    totalWeight,
    volumeUtilization: items.reduce((sum, p) => sum + volume(p.actualDimensions), 0) / volume(plan.vehicle.dimensions),
    weightUtilization: totalWeight / plan.vehicle.maxWeightKg,
    centerOfGravity: totalWeight > 0 ? { x: center.x / totalWeight, y: center.y / totalWeight, z: center.z / totalWeight } : undefined,
  }
}

export function planMarkdown(plan: PackPlan, title: string): string {
  const lines = [
    `# ${title}`,
    '',
    `载具：${plan.vehicle.name}，内廓 ${plan.vehicle.dimensions.length}×${plan.vehicle.dimensions.width}×${plan.vehicle.dimensions.height} mm，演示载重 ${plan.vehicle.maxWeightKg} kg。`,
    `模式：${plan.mode === 'priority' ? '按卸货优先级，先卸的靠近门' : '忽略站点，厚件先从里端放置'}。`,
    `已装 ${plan.placed.length} 件，未装 ${plan.unpacked.length} 件，总重 ${plan.totalWeightKg.toFixed(1)} kg，跨站阻挡 ${plan.crossStopBlocks} 件。`,
    '本清单是演示摆放，不是法定计量、轴荷或加固计算。',
    '',
    '## 装载顺序',
    '',
  ]
  plan.loadOrder.forEach((piece, index) => {
    const stop = plan.stops.find((item) => item.id === piece.stopId)
    lines.push(`${index + 1}. ${piece.item.name}（${piece.item.id}）→ ${stop?.name || piece.stopId}，位置 x=${Math.round(piece.position.x)} mm`)
  })
  for (const stop of [...plan.stops].sort((a, b) => a.priority - b.priority)) {
    lines.push('', `## 卸货 · ${stop.name}`, '')
    const rows = unloadOrder(plan, stop.id)
    if (!rows.length) lines.push('无')
    rows.forEach((piece, index) => lines.push(`${index + 1}. ${piece.item.name}（${piece.item.id}），${piece.item.weight} kg`))
  }
  if (plan.unpacked.length) {
    lines.push('', '## 未装', '')
    for (const piece of plan.unpacked) lines.push(`- ${piece.item.name}（${piece.item.id}）：${piece.reason}`)
  }
  return lines.join('\n')
}
